-- Generic creation records for AI-generated email drafts and future files.
create table if not exists public.creations (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    created_by uuid references public.users(id) on delete set null,
    email_id uuid references public.emails(id) on delete set null,
    case_id uuid references public.cases(id) on delete set null,
    conversation_id uuid references public.conversations(id) on delete set null,
    source_message_id uuid references public.messages(id) on delete set null,
    parent_creation_id uuid references public.creations(id) on delete set null,
    workflow_execution_id uuid references public.workflow_executions(id) on delete set null,
    idempotency_key text not null,
    creation_type text not null,
    status public.action_status not null default 'queued',
    title text,
    prompt text,
    context_snapshot jsonb not null default '{}'::jsonb,
    output_json jsonb not null default '{}'::jsonb,
    storage_path text,
    mime_type text,
    byte_size bigint,
    checksum text,
    provider text,
    model text,
    error_data jsonb not null default '{}'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz,
    constraint creations_type_valid check (creation_type in ('email_draft', 'document', 'pdf', 'spreadsheet', 'image')),
    constraint creations_byte_size_valid check (byte_size is null or byte_size > 0),
    constraint creations_idempotency_unique unique (organization_id, idempotency_key)
);

create index if not exists creations_organization_created_idx
on public.creations(organization_id, created_at desc);

create index if not exists creations_email_created_idx
on public.creations(organization_id, email_id, created_at desc);

create index if not exists creations_status_idx
on public.creations(organization_id, status, created_at desc);

create index if not exists creations_case_idx
on public.creations(organization_id, case_id, created_at desc);

create index if not exists creations_created_by_fk_idx on public.creations(created_by);
create index if not exists creations_email_fk_idx on public.creations(email_id);
create index if not exists creations_case_fk_idx on public.creations(case_id);
create index if not exists creations_conversation_fk_idx on public.creations(conversation_id);
create index if not exists creations_source_message_fk_idx on public.creations(source_message_id);
create index if not exists creations_parent_fk_idx on public.creations(parent_creation_id);
create index if not exists creations_workflow_execution_fk_idx on public.creations(workflow_execution_id);

drop trigger if exists creations_updated_at on public.creations;
create trigger creations_updated_at
before update on public.creations
for each row execute function public.set_updated_at();

alter table public.creations enable row level security;

revoke all on public.creations from anon;
revoke insert, update, delete on public.creations from authenticated;
grant select on public.creations to authenticated;

drop policy if exists creations_select on public.creations;
create policy creations_select
on public.creations
for select to authenticated
using (organization_id = public.current_user_organization_id());

comment on table public.creations is
'Organization-scoped metadata for AI-generated content. Binary outputs are stored in the private creations bucket.';

comment on column public.creations.context_snapshot is
'Versioned, bounded record of the sources used for generation; never a substitute for source authorization.';

comment on column public.creations.storage_path is
'Private Storage object path in the creations bucket; access must use authenticated download or signed URLs.';

alter table public.email_drafts
add column if not exists email_id uuid references public.emails(id) on delete set null;

create index if not exists email_drafts_email_idx
on public.email_drafts(organization_id, email_id, created_at desc);

insert into public.workflow_definitions (organization_id, code, name, description, n8n_workflow_id, configuration)
select null,
       'CREATOR01',
       'flujo creador',
       'Fachada de creación multimodal con contexto organizado; delega los borradores de email a PE03.',
       '4Z0FoaPgY8fo7SYo',
       '{"capabilities":["email_draft","document","pdf","spreadsheet","image"],"initial_capability":"email_draft","external_effects":[]}'::jsonb
where not exists (
    select 1 from public.workflow_definitions
    where organization_id is null and code = 'CREATOR01'
);

comment on column public.email_drafts.email_id is
'Email that originated this draft, when the draft was created from the email inbox.';


do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'creations'
  ) then
    alter publication supabase_realtime add table public.creations;
  end if;
end $$;
