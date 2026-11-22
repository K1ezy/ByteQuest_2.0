-- Additive: one expiring reservation per saved conversation, so only one turn reaches Gemini at a time.
-- Existing rows get nulls (no reservation) and keep opening. Rollback: drop the constraint, then both columns.
alter table bytequest_private.chat_conversations
  add column pending_turn_id uuid,
  add column pending_until timestamptz,
  add constraint chat_conversations_pending_pair check ((pending_turn_id is null) = (pending_until is null));
