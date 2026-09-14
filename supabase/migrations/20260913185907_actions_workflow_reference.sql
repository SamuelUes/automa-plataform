alter table public.actions
  add column if not exists workflow_id uuid;

update public.actions as a
set workflow_id = wd.id
from public.workflow_definitions as wd
where a.workflow_id is null
  and wd.code = a.workflow_name
  and (wd.organization_id = a.organization_id or wd.organization_id is null);

alter table public.actions
  add constraint actions_workflow_id_fkey
  foreign key (workflow_id) references public.workflow_definitions(id)
  on delete set null;

create index if not exists actions_workflow_idx
  on public.actions(organization_id, workflow_id);

comment on column public.actions.workflow_name is
  'Workflow code kept for compatibility with external contracts; workflow_id is the canonical local reference.';
