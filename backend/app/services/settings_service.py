"""Versioned operational settings with optimistic concurrency.

These settings change platform behaviour (retry limits, upload cap, retrieval
size), so a stale form must never silently overwrite another administrator.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.entities import PlatformSetting, Profile
from app.services.audit import record_audit
from app.services.workspace_common import iso

SERVICE_LABELS = {
    "processing": "Processing",
    "rag": "RAG indexing",
    "prediction": "Prediction",
    "assessment": "Assessment runner",
}


def _typed_value(setting: PlatformSetting) -> Any:
    value = setting.value
    if setting.value_type == "integer":
        try:
            return int(value)
        except (TypeError, ValueError):
            return value
    if setting.value_type == "boolean":
        return bool(value)
    return value if isinstance(value, str) else str(value)


def get_setting_int(db: Session, key: str, default: int) -> int:
    setting = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    if setting is None:
        return default
    try:
        return int(setting.value)
    except (TypeError, ValueError):
        return default


def serialize_setting(setting: PlatformSetting, editor: Profile | None = None) -> dict:
    return {
        "key": setting.key,
        "service": setting.service,
        "service_label": SERVICE_LABELS.get(setting.service, setting.service),
        "label": setting.label,
        "description": setting.description,
        "value": _typed_value(setting),
        "value_type": setting.value_type,
        "min_value": setting.min_value,
        "max_value": setting.max_value,
        "version": setting.version,
        "updated_at": iso(setting.updated_at),
        "last_editor": (editor.display_name or editor.pseudonym_id) if editor is not None else None,
        "last_editor_id": str(setting.updated_by) if setting.updated_by else None,
    }


def list_settings(db: Session) -> list[dict]:
    settings = db.query(PlatformSetting).order_by(PlatformSetting.service.asc(), PlatformSetting.label.asc()).all()
    editor_ids = {setting.updated_by for setting in settings if setting.updated_by}
    editors: dict[uuid.UUID, Profile] = {}
    if editor_ids:
        editors = {
            profile.id: profile
            for profile in db.query(Profile).filter(Profile.id.in_(list(editor_ids))).all()
        }
    return [serialize_setting(setting, editors.get(setting.updated_by)) for setting in settings]


def _coerce(setting: PlatformSetting, value: Any) -> Any:
    if setting.value_type == "integer":
        if isinstance(value, bool) or not isinstance(value, (int, float)) or int(value) != value:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "invalid_value",
                    "field": setting.key,
                    "message": "Enter a whole number.",
                },
            )
        number = int(value)
    elif setting.value_type == "string":
        if not isinstance(value, str):
            value = str(value)
        number = None
        text_value = value.strip()
        if not text_value:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "invalid_value",
                    "field": setting.key,
                    "message": "Enter a value.",
                },
            )
        try:
            number = float(text_value)
        except ValueError:
            number = None
        if setting.min_value is not None or setting.max_value is not None:
            if number is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "code": "invalid_value",
                        "field": setting.key,
                        "message": "Enter a number.",
                    },
                )
        if number is not None:
            if setting.min_value is not None and number < float(setting.min_value):
                raise _range_error(setting)
            if setting.max_value is not None and number > float(setting.max_value):
                raise _range_error(setting)
        return text_value
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_value", "message": "Unsupported setting type."},
        )

    if setting.min_value is not None and number < int(setting.min_value):
        raise _range_error(setting)
    if setting.max_value is not None and number > int(setting.max_value):
        raise _range_error(setting)
    return number


def _range_error(setting: PlatformSetting) -> HTTPException:
    bounds = []
    if setting.min_value is not None:
        bounds.append(f"at least {int(setting.min_value)}")
    if setting.max_value is not None:
        bounds.append(f"at most {int(setting.max_value)}")
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "code": "invalid_value",
            "field": setting.key,
            "message": f"{setting.label} must be {' and '.join(bounds)}.",
        },
    )


def update_setting(
    db: Session,
    *,
    actor: Profile,
    key: str,
    value: Any,
    expected_version: int,
) -> dict:
    setting = (
        db.query(PlatformSetting)
        .filter(PlatformSetting.key == key)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if setting is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "That setting does not exist."})
    if expected_version != setting.version:
        editor = db.query(Profile).filter(Profile.id == setting.updated_by).first() if setting.updated_by else None
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "version_conflict",
                "message": "Another administrator saved this setting first. Reload the latest value and compare your change.",
                "latest": serialize_setting(setting, editor),
            },
        )
    coerced = _coerce(setting, value)
    previous = _typed_value(setting)
    setting.value = coerced
    setting.version = setting.version + 1
    setting.updated_by = actor.id
    setting.updated_at = datetime.now(timezone.utc)
    record_audit(
        db,
        actor=actor,
        action="setting.updated",
        entity_type="platform_setting",
        entity_id=key,
        summary=f"{setting.label}: {previous} → {coerced}",
        metadata={"key": key, "previous": previous, "value": coerced, "version": setting.version},
    )
    db.commit()
    db.refresh(setting)
    return serialize_setting(setting, actor)
