-- Active: 1789052866193@@db.aqackcsunogyyyhclixh.supabase.co@5432@postgres@public
-- Channel and external correlation for the single callback-owned conversation writer.
alter table public.messages
  add column if not exists channel text not null default 'dashboard';

alter table public.messages
  drop constraint if exists messages_channel_valid;

alter table public.messages
  add constraint messages_channel_valid
  check (channel in ('dashboard', 'whatsapp', 'system'));

create index if not exists idx_messages_conversation_channel_created
on public.messages(conversation_id, channel, created_at, id);

comment on column public.messages.channel is
  'Ingress channel for the message. n8n computes it; workflow-bridge is the single persistence writer.';
