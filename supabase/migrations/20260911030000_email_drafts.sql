-- Active: 1789052866193@@db.aqackcsunogyyyhclixh.supabase.co@5432@postgres@public
-- PE03 drafts are persisted separately from conversation messages until approved/sent.
create table if not exists public.email_drafts (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    case_id uuid references public.cases(id) on delete set null,
    conversation_id uuid references public.conversations(id) on delete set null,
    command_id uuid references public.commands(id) on delete set null,
    workflow_execution_id text,
    to_address text,
    cc_addresses text[] not null default '{}',
    bcc_addresses text[] not null default '{}',
    subject text,
    body text not null,
    status text not null default 'draft',
    provider text not null default 'anthropic',
    model text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    approved_at timestamptz,
    sent_at timestamptz,
    constraint email_drafts_status_valid check (status in ('draft', 'pending_review', 'approved', 'rejected', 'sent', 'discarded'))
);

create index if not exists email_drafts_organization_created_idx
on public.email_drafts(organization_id, created_at desc);

create index if not exists email_drafts_conversation_idx
on public.email_drafts(conversation_id, created_at desc);

create index if not exists email_drafts_case_idx
on public.email_drafts(case_id, created_at desc);

create index if not exists email_drafts_status_idx
on public.email_drafts(organization_id, status, created_at desc);

create trigger email_drafts_updated_at
before update on public.email_drafts
for each row execute function public.set_updated_at();

alter table public.email_drafts enable row level security;

drop policy if exists email_drafts_select on public.email_drafts;
create policy email_drafts_select
on public.email_drafts
for select to authenticated
using (organization_id = public.current_user_organization_id());

drop policy if exists email_drafts_insert on public.email_drafts;
create policy email_drafts_insert
on public.email_drafts
for insert to authenticated
with check (organization_id = public.current_user_organization_id());

drop policy if exists email_drafts_update on public.email_drafts;
create policy email_drafts_update
on public.email_drafts
for update to authenticated
using (organization_id = public.current_user_organization_id())
with check (organization_id = public.current_user_organization_id());

comment on table public.email_drafts is
'AI-prepared email drafts. Drafts remain separate from messages until approved or sent.';

comment on column public.email_drafts.command_id is
'Command and authority decision that requested this draft.';

comment on column public.email_drafts.metadata is
'Provider response and generation metadata; does not replace the normalized draft fields.';

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'email_drafts'
  ) then
    alter publication supabase_realtime add table public.email_drafts;
  end if;
end $$;
