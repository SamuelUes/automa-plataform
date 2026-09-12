-- Active: 1789052866193@@db.aqackcsunogyyyhclixh.supabase.co@5432@postgres@public
-- Conversation message contract: n8n persists the exchange after LLM completion.
alter table public.messages
  add column if not exists request_id uuid;

create index if not exists idx_messages_conversation_created_id
on public.messages(conversation_id, created_at, id);

create unique index if not exists messages_conversation_request_sender_idx
on public.messages(conversation_id, request_id, sender_type)
where request_id is not null;

drop policy if exists messages_update
on public.messages;

create policy messages_update
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.organization_id = public.current_user_organization_id()
  )
)
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.organization_id = public.current_user_organization_id()
  )
);

comment on column public.messages.request_id is
  'Correlation key for the dashboard request and the n8n callback.';

-- Realtime is used by the dashboards to reconcile optimistic messages.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Current conversation/case context snapshot used by n8n and the dashboard.
create table if not exists public.context (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  context_type text not null default 'conversation',
  content_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint context_type_valid check (context_type in ('conversation', 'case', 'assistant')),
  constraint context_version_positive check (version > 0),
  unique (conversation_id)
);

alter table public.messages
  add column if not exists context_id uuid references public.context(id) on delete set null;

create index if not exists idx_context_organization
on public.context(organization_id);

create index if not exists idx_context_case
on public.context(case_id);

create index if not exists idx_messages_context
on public.messages(context_id);

drop trigger if exists context_updated_at on public.context;
create trigger context_updated_at
before update on public.context
for each row execute function public.set_updated_at();

alter table public.context enable row level security;

drop policy if exists context_select on public.context;
create policy context_select
on public.context
for select
to authenticated
using (organization_id = public.current_user_organization_id());

drop policy if exists context_insert on public.context;
create policy context_insert
on public.context
for insert
to authenticated
with check (organization_id = public.current_user_organization_id());

drop policy if exists context_update on public.context;
create policy context_update
on public.context
for update
to authenticated
using (organization_id = public.current_user_organization_id())
with check (organization_id = public.current_user_organization_id());

comment on table public.context is
  'Latest JSON context snapshot for a conversation and its optional case.';

comment on column public.messages.context_id is
  'Context snapshot used to generate this message exchange.';
