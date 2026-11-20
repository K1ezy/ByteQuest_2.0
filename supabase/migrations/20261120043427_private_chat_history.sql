create table bytequest_private.chat_conversations (
  id uuid primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New chat' check (char_length(title) between 1 and 100),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table bytequest_private.chat_turns (
  conversation_id uuid not null references bytequest_private.chat_conversations(id) on delete cascade,
  id uuid not null,
  position integer not null check (position > 0),
  question text not null,
  reply text not null,
  sources jsonb not null default '[]',
  primary key (conversation_id, id),
  unique (conversation_id, position)
);

create index chat_conversations_recent on bytequest_private.chat_conversations (owner_id, last_message_at desc, id desc);
create index chat_conversations_retention on bytequest_private.chat_conversations ((coalesce(last_message_at, created_at)));

alter table bytequest_private.chat_conversations enable row level security;
alter table bytequest_private.chat_turns enable row level security;
revoke all on bytequest_private.chat_conversations, bytequest_private.chat_turns from public, anon, authenticated, service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('bytequest-expire-chat-history', '15 18 * * *',
  $$delete from bytequest_private.chat_conversations
    where coalesce(last_message_at, created_at) <= now() - interval '720 hours'$$);
