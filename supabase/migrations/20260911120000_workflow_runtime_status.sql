create table if not exists public.workflow_runtime_status (
    workflow_id uuid primary key references public.workflow_definitions(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    workflow_code text not null,
    status text not null default 'unknown',
    available boolean not null default false,
    last_synced_at timestamptz not null default now(),
    last_changed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint workflow_runtime_status_valid check (status in ('active', 'inactive', 'unavailable', 'unknown')),
    unique (organization_id, workflow_code)
);

create index if not exists workflow_runtime_status_org_idx
on public.workflow_runtime_status (organization_id, status, updated_at desc);

alter table public.workflow_runtime_status enable row level security;

create policy "Users can view runtime status in their organization"
on public.workflow_runtime_status
for select
to authenticated
using (
    organization_id = (select organization_id from public.users where id = (select auth.uid()))
);

create or replace function public.set_workflow_runtime_status_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger workflow_runtime_status_updated_at
before update on public.workflow_runtime_status
for each row execute function public.set_workflow_runtime_status_updated_at();
