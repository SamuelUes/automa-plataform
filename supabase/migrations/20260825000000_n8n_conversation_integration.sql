-- Active: 1787530257995@@aws-0-us-east-1.pooler.supabase.com@5432@postgres@public
-- Centralized n8n integration: correlation, idempotency and conversation updates.
alter table public.workflow_executions add column if not exists request_id uuid;
alter table public.workflow_executions add column if not exists correlation_id uuid;
alter table public.workflow_executions add column if not exists idempotency_key text;
alter table public.workflow_executions add column if not exists source_message_id uuid references public.messages(id) on delete set null;
alter table public.workflow_events add column if not exists idempotency_key text;

create unique index if not exists workflow_executions_idempotency_key_idx
on public.workflow_executions(idempotency_key)
where idempotency_key is not null;

create unique index if not exists workflow_events_idempotency_key_idx
on public.workflow_events(organization_id, idempotency_key)
where idempotency_key is not null;

create index if not exists workflow_executions_correlation_idx
on public.workflow_executions(correlation_id);

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_on_message();

comment on column public.workflow_executions.idempotency_key is 'Stable key shared by dashboard, Edge Functions and n8n.';
comment on column public.workflow_events.idempotency_key is 'Prevents duplicate callback/event application.';
