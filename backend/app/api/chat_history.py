"""Private, account-owned conversations for the learning assistant."""

import json
from contextlib import suppress
from datetime import datetime
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.chat import (
    ChatMessageRequest, ChatMessageResponse, ChatSource, ChatTurn, _require_student_chat, generate_chat_reply,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.quotas import reserve
from app.core.security import get_current_user
from app.models.entities import Profile, UserRole

router = APIRouter(prefix=f"{settings.API_V1_STR}/chat/conversations", tags=["Chat Assistant"])

_CONVERSATIONS = "bytequest_private.chat_conversations"
_TURNS = "bytequest_private.chat_turns"
_SUMMARY = "id, title, revision, last_message_at"
_TURN = "id, position, question, reply, sources"
_ACTIVE = "coalesce(last_message_at, created_at) > now() - interval '720 hours'"
_PAGE = 25
_CHANGED = {"code": "conversation_changed", "message": "This chat changed. Reopen it to continue."}
# The reservation outlives CHAT_TIMEOUT_SECONDS (max 60), so an abandoned request blocks its chat only briefly.
_CLAIM = f"""
    update {_CONVERSATIONS} set pending_turn_id = :turn, pending_until = now() + interval '90 seconds'
    where id = :id and (pending_until is null or pending_until <= now()) returning id
"""
_RELEASE = f"update {_CONVERSATIONS} set pending_turn_id = null, pending_until = null where id = :id and pending_turn_id = :turn"


class Conversation(BaseModel):
    id: UUID
    title: str
    revision: int
    last_message_at: datetime | None


class SavedTurn(BaseModel):
    id: UUID
    position: int
    question: str
    reply: str
    sources: list[ChatSource]


class ConversationPage(BaseModel):
    items: list[Conversation]
    next_offset: int | None


class Transcript(BaseModel):
    conversation: Conversation
    turns: list[SavedTurn]
    before: int | None


class CreateConversation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID | None = None


class RenameConversation(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=100)


class SendTurn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    turn_id: UUID
    question: str = Field(min_length=1, max_length=8_000)
    expected_revision: int = Field(ge=0)
    activity_id: UUID | None = None


class SavedReply(BaseModel):
    conversation: Conversation
    turn: SavedTurn


class TurnStatus(BaseModel):
    status: Literal["completed", "pending", "missing"]
    conversation: Conversation
    turn: SavedTurn | None = None


def _history_user(response: Response, user: Profile = Depends(get_current_user), db: Session = Depends(get_db)) -> Profile:
    response.headers["Cache-Control"] = "no-store"
    if not settings.chat_history_enabled:
        raise HTTPException(503, "Saved chat history is unavailable.")
    return user


def _find_conversation(db: Session, owner: UUID, conversation_id: UUID, *, lock: bool = False) -> Conversation | None:
    suffix = " for update" if lock else ""
    row = db.execute(text(f"""
        select {_SUMMARY} from {_CONVERSATIONS}
        where id = :id and owner_id = :owner and {_ACTIVE}{suffix}
    """), {"id": conversation_id, "owner": owner}).mappings().one_or_none()
    return Conversation(**row) if row else None


def _owned_conversation(db: Session, owner: UUID, conversation_id: UUID, *, lock: bool = False) -> Conversation:
    conversation = _find_conversation(db, owner, conversation_id, lock=lock)
    if conversation is None:
        raise HTTPException(404, {"code": "conversation_missing", "message": "This chat was deleted or expired."})
    return conversation


def _saved_turn(db: Session, conversation_id: UUID, turn_id: UUID) -> SavedTurn | None:
    row = db.execute(text(f"select {_TURN} from {_TURNS} where conversation_id = :id and id = :turn"),
                     {"id": conversation_id, "turn": turn_id}).mappings().one_or_none()
    return SavedTurn(**row) if row else None


def _turns(db: Session, conversation_id: UUID, before: int, limit: int) -> list[SavedTurn]:
    rows = db.execute(text(f"""
        select {_TURN} from {_TURNS}
        where conversation_id = :id and position < :before
        order by position desc limit :limit
    """), {"id": conversation_id, "before": before, "limit": limit}).mappings()
    return [SavedTurn(**row) for row in rows]


@router.get("", response_model=ConversationPage)
def list_conversations(
    q: str = Query(default="", max_length=100),
    offset: int = Query(default=0, ge=0),
    user: Profile = Depends(_history_user),
    db: Session = Depends(get_db),
) -> ConversationPage:
    rows = db.execute(text(f"""
        select {_SUMMARY} from {_CONVERSATIONS}
        where owner_id = :owner and last_message_at is not null and {_ACTIVE}
          and strpos(lower(title), lower(:query)) > 0
        order by last_message_at desc, id desc offset :offset limit :limit
    """), {"owner": user.id, "query": q.strip(), "offset": offset, "limit": _PAGE + 1}).mappings().all()
    return ConversationPage(items=[Conversation(**row) for row in rows[:_PAGE]],
                            next_offset=offset + _PAGE if len(rows) > _PAGE else None)


@router.post("", response_model=Conversation, status_code=201)
def create_conversation(
    response: Response, payload: CreateConversation | None = None,
    user: Profile = Depends(_history_user), db: Session = Depends(get_db),
) -> Conversation:
    if user.role == UserRole.student:
        _require_student_chat(db, user.id)
    client_id = payload.id if payload else None
    # A retried first send repeats its client ID: return that chat without charging quota again.
    existing = _find_conversation(db, user.id, client_id) if client_id else None
    if existing is None:
        reserve("chat_conversation", user.id, session=db)
        row = db.execute(text(f"""
            insert into {_CONVERSATIONS} (id, owner_id) values (:id, :owner)
            on conflict (id) do nothing returning {_SUMMARY}
        """), {"id": client_id or uuid4(), "owner": user.id}).mappings().one_or_none()
        if row is not None:
            db.commit()
            return Conversation(**row)
        db.rollback()  # Also undoes the quota charge.
        existing = _find_conversation(db, user.id, client_id)
        if existing is None:
            raise HTTPException(409, {"code": "conversation_unavailable", "message": "Start a new chat to continue."})
    response.status_code = 200
    return existing


@router.get("/{conversation_id}", response_model=Transcript)
def get_conversation(
    conversation_id: UUID,
    before: int | None = Query(default=None, gt=0),
    user: Profile = Depends(_history_user),
    db: Session = Depends(get_db),
) -> Transcript:
    conversation = _owned_conversation(db, user.id, conversation_id)
    turns = _turns(db, conversation_id, min(before or conversation.revision + 1, conversation.revision + 1), _PAGE + 1)
    page = turns[:_PAGE]
    return Transcript(conversation=conversation, turns=page[::-1], before=page[-1].position if len(turns) > _PAGE else None)


@router.patch("/{conversation_id}", response_model=Conversation)
def rename_conversation(
    conversation_id: UUID, payload: RenameConversation,
    user: Profile = Depends(_history_user), db: Session = Depends(get_db),
) -> Conversation:
    _owned_conversation(db, user.id, conversation_id, lock=True)
    row = db.execute(text(f"update {_CONVERSATIONS} set title = :title where id = :id returning {_SUMMARY}"),
                     {"title": payload.title, "id": conversation_id}).mappings().one()
    db.commit()
    return Conversation(**row)


@router.delete("", status_code=204)
def delete_history(user: Profile = Depends(_history_user), db: Session = Depends(get_db)) -> None:
    db.execute(text(f"delete from {_CONVERSATIONS} where owner_id = :owner"), {"owner": user.id})
    db.commit()


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: UUID, user: Profile = Depends(_history_user), db: Session = Depends(get_db)) -> None:
    _owned_conversation(db, user.id, conversation_id, lock=True)
    db.execute(text(f"delete from {_CONVERSATIONS} where id = :id"), {"id": conversation_id})
    db.commit()


@router.get("/{conversation_id}/turns/{turn_id}", response_model=TurnStatus)
def get_turn_status(
    conversation_id: UUID, turn_id: UUID,
    user: Profile = Depends(_history_user), db: Session = Depends(get_db),
) -> TurnStatus:
    """Read-only recovery for a lost reply: never reserves quota or calls Gemini."""
    conversation = _owned_conversation(db, user.id, conversation_id)
    turn = _saved_turn(db, conversation_id, turn_id)
    if turn:
        return TurnStatus(status="completed", conversation=conversation, turn=turn)
    pending = db.scalar(text(f"select pending_turn_id = :turn and pending_until > now() from {_CONVERSATIONS} where id = :id"),
                        {"id": conversation_id, "turn": turn_id})
    return TurnStatus(status="pending" if pending else "missing", conversation=conversation)


def _check_revision(db: Session, conversation: Conversation, payload: SendTurn) -> SavedReply | None:
    turn = _saved_turn(db, conversation.id, payload.turn_id)
    if turn is not None and turn.question == payload.question:
        return SavedReply(conversation=conversation, turn=turn)
    if turn is not None or conversation.revision != payload.expected_revision:
        raise HTTPException(409, _CHANGED)
    return None


def _reply_payload(payload: SendTurn, recent: list[SavedTurn]) -> ChatMessageRequest:
    budget = min(settings.CHAT_MAX_MESSAGE_CHARS, settings.CHAT_MAX_TOTAL_CHARS)
    if len(payload.question) > budget:
        raise HTTPException(422, "Shorten your question and send it again.")
    context = [ChatTurn(role="user", content=payload.question)]
    remaining = settings.CHAT_MAX_TOTAL_CHARS - len(payload.question)
    for turn in recent:
        if len(context) + 2 > settings.CHAT_MAX_MESSAGES:
            break
        if max(len(turn.question), len(turn.reply)) > settings.CHAT_MAX_MESSAGE_CHARS:
            break
        size = len(turn.question) + len(turn.reply)
        if size > remaining:
            break
        context.extend([ChatTurn(role="assistant", content=turn.reply), ChatTurn(role="user", content=turn.question)])
        remaining -= size
    return ChatMessageRequest(messages=context[::-1], activity_id=payload.activity_id)


@router.post("/{conversation_id}/turns", response_model=SavedReply)
async def send_saved_turn(
    conversation_id: UUID, payload: SendTurn,
    user: Profile = Depends(_history_user), db: Session = Depends(get_db),
) -> SavedReply:
    # Claim the turn in a short transaction; the row lock is released before the provider call.
    conversation = _owned_conversation(db, user.id, conversation_id, lock=True)
    replay = _check_revision(db, conversation, payload)
    if replay:
        db.rollback()
        return replay
    recent = _turns(db, conversation_id, conversation.revision + 1, settings.CHAT_MAX_MESSAGES // 2)
    request = _reply_payload(payload, recent)
    if db.execute(text(_CLAIM), {"id": conversation_id, "turn": payload.turn_id}).first() is None:
        db.rollback()
        raise HTTPException(409, {"code": "chat_turn_in_progress",
                                  "message": "A reply is still being prepared for this chat. Check again in a moment."})
    db.commit()
    try:
        answer = await generate_chat_reply(request, user, db)
        return _save_turn(db, user, conversation_id, payload, answer)
    except Exception:
        # A completed failure frees the chat now; an interrupted request leaves the reservation to expire.
        db.rollback()
        with suppress(SQLAlchemyError):
            db.execute(text(_RELEASE), {"id": conversation_id, "turn": payload.turn_id})
            db.commit()
        raise


def _save_turn(db: Session, user: Profile, conversation_id: UUID, payload: SendTurn, answer: ChatMessageResponse) -> SavedReply:
    conversation = _owned_conversation(db, user.id, conversation_id, lock=True)
    replay = _check_revision(db, conversation, payload)
    if replay:
        db.rollback()
        return replay
    position = conversation.revision + 1
    # Commit only while this turn still holds the reservation.
    row = db.execute(text(f"""
        update {_CONVERSATIONS} set revision = :position, last_message_at = now(), pending_turn_id = null, pending_until = null,
          title = case when revision = 0 and title = 'New chat' then :title else title end
        where id = :id and pending_turn_id = :turn returning {_SUMMARY}
    """), {"position": position, "id": conversation_id, "turn": payload.turn_id,
             "title": " ".join(payload.question.split())[:100]}).mappings().one_or_none()
    if row is None:
        raise HTTPException(409, _CHANGED)
    turn = SavedTurn(id=payload.turn_id, position=position, question=payload.question, reply=answer.reply, sources=answer.sources)
    db.execute(text(f"""
        insert into {_TURNS} (conversation_id, id, position, question, reply, sources)
        values (:conversation, :turn, :position, :question, :reply, cast(:sources as jsonb))
    """), {"conversation": conversation_id, "turn": turn.id, "position": position,
             "question": turn.question, "reply": turn.reply,
             "sources": json.dumps([source.model_dump() for source in turn.sources])})
    db.commit()
    return SavedReply(conversation=Conversation(**row), turn=turn)
