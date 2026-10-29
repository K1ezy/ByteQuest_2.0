"""Optional institutional SMTP delivery for in-app notification outbox."""

import logging
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

import httpx

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.entities import NotificationOutbox

logger = logging.getLogger(__name__)


def deliver_one() -> bool:
    if not settings.EMAIL_ENABLED:
        with SessionLocal() as db:
            notice = db.query(NotificationOutbox).filter(
                NotificationOutbox.status == "pending",
                NotificationOutbox.next_attempt_at <= datetime.now(timezone.utc),
            ).order_by(NotificationOutbox.next_attempt_at, NotificationOutbox.id).with_for_update(skip_locked=True).first()
            if notice is not None:
                notice.status = "skipped_disabled"
                db.commit()
                logger.warning(
                    "Email delivery skipped (EMAIL_ENABLED=False). Marked notification id=%s as skipped_disabled.",
                    notice.id,
                )
                return True
        return False

    if not (settings.OUTBOUND_EMAIL_ENABLED and settings.SMTP_HOST and settings.SMTP_USERNAME
            and settings.SMTP_PASSWORD and settings.SMTP_FROM and settings.SUPABASE_URL
            and settings.SUPABASE_SERVICE_ROLE_KEY):
        return False
    with SessionLocal() as db:
        notice = db.query(NotificationOutbox).filter(
            NotificationOutbox.status == "pending",
            NotificationOutbox.next_attempt_at <= datetime.now(timezone.utc),
        ).order_by(NotificationOutbox.next_attempt_at, NotificationOutbox.id).with_for_update(skip_locked=True).first()
        if notice is None:
            return False

        try:
            response = httpx.get(
                f"{settings.SUPABASE_URL}/auth/v1/admin/users/{notice.recipient_id}",
                headers={"apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                         "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"},
                timeout=5,
            )
            response.raise_for_status()
            address = response.json().get("email")
            if not isinstance(address, str) or "@" not in address:
                raise ValueError("Recipient address unavailable")
            message = EmailMessage()
            message["From"] = settings.SMTP_FROM
            message["To"] = address
            message["Subject"] = notice.subject.replace("\r", " ").replace("\n", " ")
            message.set_content(notice.body)
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                smtp.send_message(message)
            notice.status = "delivered"
        except Exception:
            logger.warning("Institutional email delivery failed for notification id=%s", notice.id)
            notice.attempts += 1
            notice.next_attempt_at = datetime.now(timezone.utc) + timedelta(minutes=min(60, 2 ** min(notice.attempts, 6)))
            if notice.attempts >= 8:
                notice.status = "failed"
        db.commit()
        return True
