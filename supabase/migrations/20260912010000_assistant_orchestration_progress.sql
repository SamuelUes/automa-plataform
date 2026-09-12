-- Assistant orchestration progress and parent/child workflow tracing.
insert into public.workflow_definitions (organization_id, code, name, description, n8n_workflow_id, configuration)
select null, 'ORQ01', 'Orquestador de Flujos', 'Selecciona y despacha flujos operacionales para solicitudes delegadas por PE08.', '3IgU3nupZXXMdduF', '{"excluded_workflows":["PE08","PE13"],"targets":["PE01","PE02","PE03","PE04","PE05","PE06","PE07","PE09","PE10","PE11","PE12"]}'::jsonb
where not exists (select 1 from public.workflow_definitions where organization_id is null and code = 'ORQ01');

alter table public.workflow_executions
  add column if not exists parent_workflow_execution_id uuid references public.workflow_executions(id),
  add column if not exists orchestration_id uuid,
  add column if not exists tool_call_id text;

create table if not exists public.assistant_request_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  request_id uuid not null,
  workflow_execution_id uuid references public.workflow_executions(id) on delete cascade,
  source_channel text not null check (source_channel in ('dashboard', 'whatsapp')),
  status text not null check (status in ('received', 'classifying', 'direct_response', 'orchestrator_selected', 'workflow_selected', 'workflow_running', 'response_preparing', 'completed', 'needs_clarification', 'requires_approval', 'failed')),
  label text not null,
  progress_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, request_id, status)
);

create index if not exists assistant_request_progress_lookup_idx
  on public.assistant_request_progress (organization_id, conversation_id, request_id, created_at);

alter table public.assistant_request_progress enable row level security;

create policy "assistant progress visible to organization members"
  on public.assistant_request_progress for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.organization_id = assistant_request_progress.organization_id
    )
  );

create policy "assistant progress managed by service role"
  on public.assistant_request_progress for all
  to service_role
  using (true)
  with check (true);

alter publication supabase_realtime add table public.assistant_request_progress;
