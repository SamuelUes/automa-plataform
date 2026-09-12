-- Conversation inactivity controls for PE08 and PE13.
alter type public.conversation_status add value if not exists 'paused';

alter table public.conversations
  add column if not exists status text not null default 'active',
  add column if not exists paused_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists inactivity_notice_sent_at timestamptz;

create index if not exists conversations_status_updated_idx
on public.conversations(status, updated_at);

comment on column public.conversations.status is 'Conversation lifecycle: active, paused after inactivity, or closed by a user.';
comment on column public.conversations.inactivity_notice_sent_at is 'Timestamp of the five-minute inactivity notice, when applicable.';
