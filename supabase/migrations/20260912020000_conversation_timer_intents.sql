-- Single active inactivity timer and persisted assistant intent per conversation.
alter table public.conversations
  add column if not exists last_activity_at timestamptz,
  add column if not exists inactivity_generation bigint not null default 0,
  add column if not exists active_inactivity_timer_id uuid,
  add column if not exists inactivity_deadline_at timestamptz,
  add column if not exists pending_intent jsonb not null default '{}'::jsonb;

update public.conversations
set last_activity_at = coalesce(last_activity_at, updated_at, now()),
    inactivity_deadline_at = coalesce(inactivity_deadline_at, coalesce(last_activity_at, updated_at, now()) + interval '2 minutes')
where last_activity_at is null or inactivity_deadline_at is null;

create index if not exists conversations_inactivity_deadline_idx
  on public.conversations(status, inactivity_deadline_at);

comment on column public.conversations.pending_intent is 'Structured pending assistant intent used to continue multi-turn operational requests.';
comment on column public.conversations.inactivity_generation is 'Monotonic generation used to invalidate stale n8n inactivity waits.';
