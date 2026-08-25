-- Active: 1787530257995@@aws-0-us-east-1.pooler.supabase.com@5432@postgres@public
-- ============================================================
-- PROLOGISTICA / EXECUTIVE AGENT PLATFORM
-- SUPABASE DATABASE INITIAL SCHEMA
--
-- PostgreSQL / Supabase
--
-- Características:
--   - Multi-tenant
--   - UUID
--   - RLS
--   - Supabase Auth
--   - JSONB para estructuras variables
--   - Auditoría
--   - Idempotencia
--   - n8n workflow tracking
--   - AI runs / evaluations
--   - Human-in-the-loop
--   - Conversational Command Center
--   - Approvals
--   - Delegations
--   - Follow-ups
--   - External integrations
--
-- Este script está diseñado para ser RE-EJECUTABLE.
-- ============================================================


-- ============================================================
-- 0. EXTENSIONES
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists citext;


-- ============================================================
-- 1. ENUMS
--
-- Los ENUMs se crean únicamente si no existen.
-- ============================================================

do $$
begin

    if not exists (
        select 1 from pg_type where typname = 'case_status'
    ) then
        create type public.case_status as enum (
            'new',
            'evaluating',
            'waiting_human',
            'waiting_approval',
            'approved',
            'rejected',
            'delegated',
            'in_progress',
            'waiting_customer',
            'follow_up',
            'resolved',
            'waiting_verification',
            'closed',
            'cancelled'
        );
    end if;


    if not exists (
        select 1 from pg_type where typname = 'priority_level'
    ) then
        create type public.priority_level as enum (
            'low',
            'normal',
            'high',
            'urgent',
            'critical'
        );
    end if;


    if not exists (
        select 1 from pg_type where typname = 'user_role'
    ) then
        create type public.user_role as enum (
            'owner',
            'admin',
            'manager',
            'agent',
            'viewer'
        );
    end if;


    if not exists (
        select 1 from pg_type where typname = 'email_direction'
    ) then
        create type public.email_direction as enum (
            'inbound',
            'outbound'
        );
    end if;


    if not exists (
        select 1 from pg_type where typname = 'action_status'
    ) then
        create type public.action_status as enum (
            'pending',
            'queued',
            'running',
            'completed',
            'failed',
            'cancelled',
            'expired'
        );
    end if;


    if not exists (
        select 1 from pg_type where typname = 'approval_status'
    ) then
        create type public.approval_status as enum (
            'pending',
            'approved',
            'rejected',
            'expired',
            'cancelled'
        );
    end if;


    if not exists (
        select 1 from pg_type where typname = 'workflow_status'
    ) then
        create type public.workflow_status as enum (
            'running',
            'success',
            'failed',
            'cancelled',
            'waiting'
        );
    end if;


    if not exists (
        select 1 from pg_type where typname = 'conversation_status'
    ) then
        create type public.conversation_status as enum (
            'active',
            'archived',
            'closed'
        );
    end if;


    if not exists (
        select 1 from pg_type where typname = 'message_role'
    ) then
        create type public.message_role as enum (
            'user',
            'assistant',
            'system',
            'tool'
        );
    end if;


    if not exists (
        select 1 from pg_type where typname = 'sender_type'
    ) then
        create type public.sender_type as enum (
            'human',
            'ai',
            'system',
            'workflow'
        );
    end if;

end
$$;


-- ============================================================
-- 2. HELPER FUNCTIONS
-- ============================================================


-- ------------------------------------------------------------
-- updated_at
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


-- ------------------------------------------------------------
-- current organization
--
-- IMPORTANTE:
-- No confiar en organization_id enviado desde frontend.
-- El frontend debe operar dentro de la organización del usuario.
-- ------------------------------------------------------------

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select organization_id
    from public.users
    where id = auth.uid()
      and is_active = true
    limit 1;
$$;


-- ------------------------------------------------------------
-- current role
-- ------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
    select role
    from public.users
    where id = auth.uid()
      and is_active = true
    limit 1;
$$;


-- ------------------------------------------------------------
-- is admin / owner
-- ------------------------------------------------------------

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.users
        where id = auth.uid()
          and is_active = true
          and role in ('owner', 'admin')
    );
$$;


-- ============================================================
-- 3. ORGANIZATIONS
-- ============================================================

create table if not exists public.organizations (

    id uuid primary key default gen_random_uuid(),

    name text not null,

    slug citext not null unique,

    settings jsonb not null default '{}'::jsonb,

    is_active boolean not null default true,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    constraint organizations_name_length
        check (char_length(trim(name)) between 2 and 200)

);


-- ============================================================
-- 4. USERS
--
-- Vinculados directamente a Supabase auth.users
-- ============================================================

create table if not exists public.users (

    id uuid primary key
        references auth.users(id)
        on delete cascade,

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    full_name text,

    email citext,

    avatar_url text,

    role public.user_role not null default 'agent',

    settings jsonb not null default '{}'::jsonb,

    is_active boolean not null default true,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);


-- ============================================================
-- 5. DEPARTMENTS
-- ============================================================

create table if not exists public.departments (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    name text not null,

    description text,

    metadata jsonb not null default '{}'::jsonb,

    is_active boolean not null default true,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique (organization_id, name)

);


-- ============================================================
-- 6. CONTACTS
-- ============================================================

create table if not exists public.contacts (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    name text,

    email citext,

    phone text,

    company text,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);


-- ============================================================
-- 7. CASES
-- ============================================================

create table if not exists public.cases (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    case_number bigint generated always as identity,

    title text not null,

    description text,

    status public.case_status not null default 'new',

    priority public.priority_level not null default 'normal',

    contact_id uuid
        references public.contacts(id)
        on delete set null,

    department_id uuid
        references public.departments(id)
        on delete set null,

    assigned_to uuid
        references public.users(id)
        on delete set null,

    source text,

    source_id text,

    requires_human boolean not null default false,

    requires_approval boolean not null default false,

    current_action_id uuid,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    resolved_at timestamptz,

    closed_at timestamptz,

    constraint cases_title_length
        check (char_length(trim(title)) between 1 and 500)

);


-- ============================================================
-- 8. EMAIL THREADS
-- ============================================================

create table if not exists public.email_threads (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    case_id uuid
        references public.cases(id)
        on delete cascade,

    external_thread_id text,

    subject text,

    participants jsonb not null default '[]'::jsonb,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);


-- ============================================================
-- 9. EMAILS
-- ============================================================

create table if not exists public.emails (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    thread_id uuid
        references public.email_threads(id)
        on delete cascade,

    case_id uuid
        references public.cases(id)
        on delete cascade,

    external_message_id text,

    direction public.email_direction not null,

    sender jsonb not null default '{}'::jsonb,

    recipients jsonb not null default '[]'::jsonb,

    cc jsonb not null default '[]'::jsonb,

    bcc jsonb not null default '[]'::jsonb,

    subject text,

    body_text text,

    body_html text,

    headers jsonb not null default '{}'::jsonb,

    metadata jsonb not null default '{}'::jsonb,

    received_at timestamptz,

    sent_at timestamptz,

    created_at timestamptz not null default now()

);


-- ============================================================
-- 10. AI EVALUATIONS
-- ============================================================

create table if not exists public.evaluations (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    case_id uuid not null
        references public.cases(id)
        on delete cascade,

    email_id uuid
        references public.emails(id)
        on delete set null,

    model text,

    evaluation_type text not null,

    decision text,

    confidence numeric(5,4),

    priority public.priority_level,

    requires_human boolean,

    requires_approval boolean,

    reasoning text,

    input_data jsonb not null default '{}'::jsonb,

    output_data jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    constraint evaluations_confidence_range
        check (
            confidence is null
            or confidence between 0 and 1
        )

);


-- ============================================================
-- 11. AI RUNS
-- ============================================================

create table if not exists public.ai_runs (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    case_id uuid
        references public.cases(id)
        on delete cascade,

    provider text,

    model text,

    prompt text,

    response text,

    input_tokens integer,

    output_tokens integer,

    latency_ms integer,

    status public.workflow_status not null default 'running',

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    completed_at timestamptz

);


-- ============================================================
-- 12. CONVERSATIONS
-- ============================================================

create table if not exists public.conversations (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    user_id uuid
        references public.users(id)
        on delete set null,

    case_id uuid
        references public.cases(id)
        on delete cascade,

    title text,

    conversation_type text not null default 'case',

    status public.conversation_status not null default 'active',

    context jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);


-- ============================================================
-- 13. MESSAGES
-- ============================================================

create table if not exists public.messages (

    id uuid primary key default gen_random_uuid(),

    conversation_id uuid not null
        references public.conversations(id)
        on delete cascade,

    user_id uuid
        references public.users(id)
        on delete set null,

    sender_type public.sender_type not null,

    role public.message_role not null,

    content text,

    content_json jsonb,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    constraint messages_content_present
        check (
            content is not null
            or content_json is not null
        )

);


-- ============================================================
-- 14. ACTIONS
--
-- PUENTE ENTRE DASHBOARD Y N8N
-- ============================================================

create table if not exists public.actions (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    case_id uuid
        references public.cases(id)
        on delete cascade,

    conversation_id uuid
        references public.conversations(id)
        on delete set null,

    message_id uuid
        references public.messages(id)
        on delete set null,

    action_type text not null,

    status public.action_status not null default 'pending',

    requested_by uuid
        references public.users(id)
        on delete set null,

    approved_by uuid
        references public.users(id)
        on delete set null,

    workflow_name text,

    n8n_execution_id text,

    input_data jsonb not null default '{}'::jsonb,

    output_data jsonb not null default '{}'::jsonb,

    error_data jsonb not null default '{}'::jsonb,

    idempotency_key text unique,

    created_at timestamptz not null default now(),

    started_at timestamptz,

    completed_at timestamptz

);


-- ============================================================
-- 15. APPROVALS
-- ============================================================

create table if not exists public.approvals (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    case_id uuid not null
        references public.cases(id)
        on delete cascade,

    action_id uuid
        references public.actions(id)
        on delete set null,

    requested_from uuid
        references public.users(id)
        on delete set null,

    status public.approval_status not null default 'pending',

    decision text,

    comment text,

    requested_at timestamptz not null default now(),

    responded_at timestamptz

);


-- ============================================================
-- 16. DELEGATIONS
-- ============================================================

create table if not exists public.delegations (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    case_id uuid not null
        references public.cases(id)
        on delete cascade,

    assigned_to uuid not null
        references public.users(id)
        on delete restrict,

    assigned_by uuid
        references public.users(id)
        on delete set null,

    department_id uuid
        references public.departments(id)
        on delete set null,

    reason text,

    status text not null default 'active',

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    completed_at timestamptz

);


-- ============================================================
-- 17. FOLLOW UPS
-- ============================================================

create table if not exists public.follow_ups (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    case_id uuid not null
        references public.cases(id)
        on delete cascade,

    scheduled_for timestamptz not null,

    reason text,

    status text not null default 'pending',

    attempt_count integer not null default 0,

    last_attempt_at timestamptz,

    completed_at timestamptz,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    constraint follow_ups_attempts_nonnegative
        check (attempt_count >= 0)

);


-- ============================================================
-- 18. WORKFLOW DEFINITIONS
--
-- PE01 - PE12
-- ============================================================

create table if not exists public.workflow_definitions (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid
        references public.organizations(id)
        on delete cascade,

    code text not null,

    name text not null,

    description text,

    n8n_workflow_id text,

    version integer not null default 1,

    is_active boolean not null default true,

    configuration jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique (organization_id, code),

    constraint workflow_version_positive
        check (version > 0)

);


-- ============================================================
-- 19. WORKFLOW EXECUTIONS
-- ============================================================

create table if not exists public.workflow_executions (

    id uuid primary key default gen_random_uuid(),

    workflow_id uuid
        references public.workflow_definitions(id)
        on delete set null,

    case_id uuid
        references public.cases(id)
        on delete set null,

    action_id uuid
        references public.actions(id)
        on delete set null,

    n8n_execution_id text,

    status public.workflow_status not null default 'running',

    trigger_type text,

    input_data jsonb not null default '{}'::jsonb,

    output_data jsonb not null default '{}'::jsonb,

    error_data jsonb not null default '{}'::jsonb,

    started_at timestamptz not null default now(),

    finished_at timestamptz

);


-- ============================================================
-- 20. WORKFLOW EVENTS
-- ============================================================

create table if not exists public.workflow_events (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    workflow_execution_id uuid
        references public.workflow_executions(id)
        on delete cascade,

    case_id uuid
        references public.cases(id)
        on delete cascade,

    event_type text not null,

    event_data jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now()

);


-- ============================================================
-- 21. DELIVERY ATTEMPTS
-- ============================================================

create table if not exists public.delivery_attempts (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    action_id uuid
        references public.actions(id)
        on delete set null,

    channel text not null,

    destination text,

    idempotency_key text not null,

    attempt_number integer not null,

    status text not null,

    external_id text,

    error_message text,

    response_data jsonb not null default '{}'::jsonb,

    attempted_at timestamptz not null default now(),

    constraint delivery_attempt_number_positive
        check (attempt_number > 0)

);


-- ============================================================
-- 22. EXTERNAL REFERENCES
--
-- Outlook
-- Jira
-- Airtable
-- WhatsApp
-- HubSpot
-- etc.
-- ============================================================

create table if not exists public.external_references (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    entity_type text not null,

    entity_id uuid not null,

    provider text not null,

    external_id text not null,

    external_url text,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    unique (provider, external_id)

);


-- ============================================================
-- 23. AUDIT LOGS
-- ============================================================

create table if not exists public.audit_logs (

    id uuid primary key default gen_random_uuid(),

    organization_id uuid
        references public.organizations(id)
        on delete cascade,

    user_id uuid
        references public.users(id)
        on delete set null,

    case_id uuid
        references public.cases(id)
        on delete set null,

    action_id uuid
        references public.actions(id)
        on delete set null,

    event_type text not null,

    entity_type text,

    entity_id uuid,

    previous_data jsonb,

    new_data jsonb,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now()

);


-- ============================================================
-- 24. TRIGGERS UPDATED_AT
-- ============================================================

drop trigger if exists trg_organizations_updated_at
on public.organizations;

create trigger trg_organizations_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();


drop trigger if exists trg_users_updated_at
on public.users;

create trigger trg_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();


drop trigger if exists trg_departments_updated_at
on public.departments;

create trigger trg_departments_updated_at
before update on public.departments
for each row
execute function public.set_updated_at();


drop trigger if exists trg_contacts_updated_at
on public.contacts;

create trigger trg_contacts_updated_at
before update on public.contacts
for each row
execute function public.set_updated_at();


drop trigger if exists trg_cases_updated_at
on public.cases;

create trigger trg_cases_updated_at
before update on public.cases
for each row
execute function public.set_updated_at();


drop trigger if exists trg_email_threads_updated_at
on public.email_threads;

create trigger trg_email_threads_updated_at
before update on public.email_threads
for each row
execute function public.set_updated_at();


drop trigger if exists trg_conversations_updated_at
on public.conversations;

create trigger trg_conversations_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();


drop trigger if exists trg_workflow_definitions_updated_at
on public.workflow_definitions;

create trigger trg_workflow_definitions_updated_at
before update on public.workflow_definitions
for each row
execute function public.set_updated_at();


-- ============================================================
-- 25. INDEXES
-- ============================================================


-- USERS

create index if not exists idx_users_org
on public.users(organization_id);

create index if not exists idx_users_role
on public.users(organization_id, role);


-- DEPARTMENTS

create index if not exists idx_departments_org
on public.departments(organization_id);


-- CONTACTS

create index if not exists idx_contacts_org
on public.contacts(organization_id);

create index if not exists idx_contacts_email
on public.contacts(email);


-- CASES

create index if not exists idx_cases_org
on public.cases(organization_id);

create index if not exists idx_cases_status
on public.cases(organization_id, status);

create index if not exists idx_cases_priority
on public.cases(organization_id, priority);

create index if not exists idx_cases_assigned
on public.cases(organization_id, assigned_to);

create index if not exists idx_cases_department
on public.cases(organization_id, department_id);

create index if not exists idx_cases_created
on public.cases(organization_id, created_at desc);


-- EMAILS

create index if not exists idx_emails_case
on public.emails(case_id);

create index if not exists idx_emails_thread
on public.emails(thread_id);

create index if not exists idx_emails_external_id
on public.emails(organization_id, external_message_id);


-- EVALUATIONS

create index if not exists idx_evaluations_case
on public.evaluations(case_id);

create index if not exists idx_evaluations_type
on public.evaluations(organization_id, evaluation_type);


-- AI RUNS

create index if not exists idx_ai_runs_case
on public.ai_runs(case_id);

create index if not exists idx_ai_runs_created
on public.ai_runs(organization_id, created_at desc);


-- CONVERSATIONS

create index if not exists idx_conversations_user
on public.conversations(user_id);

create index if not exists idx_conversations_case
on public.conversations(case_id);


-- MESSAGES

create index if not exists idx_messages_conversation
on public.messages(conversation_id, created_at);


-- ACTIONS

create index if not exists idx_actions_case
on public.actions(case_id);

create index if not exists idx_actions_status
on public.actions(organization_id, status);

create index if not exists idx_actions_pending
on public.actions(organization_id, status)
where status in ('pending', 'queued');


-- APPROVALS

create index if not exists idx_approvals_pending
on public.approvals(organization_id, status)
where status = 'pending';

create index if not exists idx_approvals_case
on public.approvals(case_id);


-- FOLLOW UPS

create index if not exists idx_followups_due
on public.follow_ups(organization_id, scheduled_for)
where status = 'pending';

create index if not exists idx_followups_case
on public.follow_ups(case_id);


-- WORKFLOWS

create index if not exists idx_workflow_definitions_org
on public.workflow_definitions(organization_id);

create index if not exists idx_workflow_executions_case
on public.workflow_executions(case_id);

create index if not exists idx_workflow_executions_workflow
on public.workflow_executions(workflow_id);

create index if not exists idx_workflow_executions_n8n
on public.workflow_executions(n8n_execution_id);


-- EVENTS

create index if not exists idx_workflow_events_case
on public.workflow_events(case_id);

create index if not exists idx_workflow_events_execution
on public.workflow_events(workflow_execution_id);

create index if not exists idx_workflow_events_created
on public.workflow_events(organization_id, created_at desc);


-- DELIVERY

create index if not exists idx_delivery_action
on public.delivery_attempts(action_id);

create index if not exists idx_delivery_idempotency
on public.delivery_attempts(idempotency_key);


-- AUDIT

create index if not exists idx_audit_org_created
on public.audit_logs(organization_id, created_at desc);

create index if not exists idx_audit_case
on public.audit_logs(case_id);

create index if not exists idx_audit_entity
on public.audit_logs(entity_type, entity_id);


-- ============================================================
-- 26. JSONB INDEXES
--
-- NO crear índices GIN sobre absolutamente todo.
-- Solo sobre JSON que realmente se consultará.
-- ============================================================

create index if not exists idx_cases_metadata_gin
on public.cases using gin(metadata);

create index if not exists idx_evaluations_output_gin
on public.evaluations using gin(output_data);

create index if not exists idx_actions_input_gin
on public.actions using gin(input_data);


-- ============================================================
-- 27. UNIQUE / IDEMPOTENCY
-- ============================================================


-- Evita duplicar mensajes externos

create unique index if not exists uq_email_external_message
on public.emails(organization_id, external_message_id)
where external_message_id is not null;


-- Evita duplicar threads externos

create unique index if not exists uq_email_external_thread
on public.email_threads(organization_id, external_thread_id)
where external_thread_id is not null;


-- ============================================================
-- 28. RLS
--
-- TODAS las tablas de negocio quedan protegidas.
-- ============================================================

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.departments enable row level security;
alter table public.contacts enable row level security;
alter table public.cases enable row level security;
alter table public.email_threads enable row level security;
alter table public.emails enable row level security;
alter table public.evaluations enable row level security;
alter table public.ai_runs enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.actions enable row level security;
alter table public.approvals enable row level security;
alter table public.delegations enable row level security;
alter table public.follow_ups enable row level security;
alter table public.workflow_definitions enable row level security;
alter table public.workflow_executions enable row level security;
alter table public.workflow_events enable row level security;
alter table public.delivery_attempts enable row level security;
alter table public.external_references enable row level security;
alter table public.audit_logs enable row level security;


-- ============================================================
-- 29. RLS POLICIES
--
-- Usuarios solo ven información de su organización.
-- ============================================================


-- ORGANIZATIONS

drop policy if exists organizations_select
on public.organizations;

create policy organizations_select
on public.organizations
for select
to authenticated
using (
    id = public.current_user_organization_id()
);


-- USERS

drop policy if exists users_select
on public.users;

create policy users_select
on public.users
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


-- Solo admins pueden modificar usuarios

drop policy if exists users_admin_update
on public.users;

create policy users_admin_update
on public.users
for update
to authenticated
using (
    organization_id = public.current_user_organization_id()
    and public.is_org_admin()
)
with check (
    organization_id = public.current_user_organization_id()
);


-- DEPARTMENTS

drop policy if exists departments_select
on public.departments;

create policy departments_select
on public.departments
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


drop policy if exists departments_modify
on public.departments;

create policy departments_modify
on public.departments
for all
to authenticated
using (
    organization_id = public.current_user_organization_id()
    and public.is_org_admin()
)
with check (
    organization_id = public.current_user_organization_id()
);


-- CONTACTS

drop policy if exists contacts_select
on public.contacts;

create policy contacts_select
on public.contacts
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


drop policy if exists contacts_modify
on public.contacts;

create policy contacts_modify
on public.contacts
for all
to authenticated
using (
    organization_id = public.current_user_organization_id()
)
with check (
    organization_id = public.current_user_organization_id()
);


-- CASES

drop policy if exists cases_select
on public.cases;

create policy cases_select
on public.cases
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


drop policy if exists cases_modify
on public.cases;

create policy cases_modify
on public.cases
for all
to authenticated
using (
    organization_id = public.current_user_organization_id()
)
with check (
    organization_id = public.current_user_organization_id()
);


-- EMAIL THREADS

drop policy if exists email_threads_select
on public.email_threads;

create policy email_threads_select
on public.email_threads
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


-- EMAILS

drop policy if exists emails_select
on public.emails;

create policy emails_select
on public.emails
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


-- EVALUATIONS

drop policy if exists evaluations_select
on public.evaluations;

create policy evaluations_select
on public.evaluations
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


-- AI RUNS

drop policy if exists ai_runs_select
on public.ai_runs;

create policy ai_runs_select
on public.ai_runs
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


-- CONVERSATIONS

drop policy if exists conversations_select
on public.conversations;

create policy conversations_select
on public.conversations
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


drop policy if exists conversations_insert
on public.conversations;

create policy conversations_insert
on public.conversations
for insert
to authenticated
with check (
    organization_id = public.current_user_organization_id()
    and (
        user_id = auth.uid()
        or user_id is null
    )
);


-- MESSAGES

drop policy if exists messages_select
on public.messages;

create policy messages_select
on public.messages
for select
to authenticated
using (
    exists (
        select 1
        from public.conversations c
        where c.id = messages.conversation_id
          and c.organization_id =
              public.current_user_organization_id()
    )
);


drop policy if exists messages_insert
on public.messages;

create policy messages_insert
on public.messages
for insert
to authenticated
with check (
    exists (
        select 1
        from public.conversations c
        where c.id = messages.conversation_id
          and c.organization_id =
              public.current_user_organization_id()
    )
);


-- ACTIONS

drop policy if exists actions_select
on public.actions;

create policy actions_select
on public.actions
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


drop policy if exists actions_insert
on public.actions;

create policy actions_insert
on public.actions
for insert
to authenticated
with check (
    organization_id = public.current_user_organization_id()
    and requested_by = auth.uid()
);


-- IMPORTANTE:
-- El frontend NO debería poder marcar una acción como completed.
-- Eso debe hacerlo n8n/backend.
--
-- Por eso NO damos UPDATE general a authenticated.


-- APPROVALS

drop policy if exists approvals_select
on public.approvals;

create policy approvals_select
on public.approvals
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


drop policy if exists approvals_insert
on public.approvals;

create policy approvals_insert
on public.approvals
for insert
to authenticated
with check (
    organization_id = public.current_user_organization_id()
);


-- DELEGATIONS

drop policy if exists delegations_select
on public.delegations;

create policy delegations_select
on public.delegations
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


-- FOLLOW UPS

drop policy if exists followups_select
on public.follow_ups;

create policy followups_select
on public.follow_ups
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


-- WORKFLOW DEFINITIONS

drop policy if exists workflow_definitions_select
on public.workflow_definitions;

create policy workflow_definitions_select
on public.workflow_definitions
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
    or organization_id is null
);


-- WORKFLOW EXECUTIONS

drop policy if exists workflow_executions_select
on public.workflow_executions;

create policy workflow_executions_select
on public.workflow_executions
for select
to authenticated
using (
    exists (
        select 1
        from public.cases c
        where c.id = workflow_executions.case_id
          and c.organization_id =
              public.current_user_organization_id()
    )
    or
    workflow_executions.case_id is null
);


-- WORKFLOW EVENTS

drop policy if exists workflow_events_select
on public.workflow_events;

create policy workflow_events_select
on public.workflow_events
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


-- DELIVERY

drop policy if exists delivery_select
on public.delivery_attempts;

create policy delivery_select
on public.delivery_attempts
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


-- EXTERNAL REFERENCES

drop policy if exists external_references_select
on public.external_references;

create policy external_references_select
on public.external_references
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


-- AUDIT LOGS

drop policy if exists audit_logs_select
on public.audit_logs;

create policy audit_logs_select
on public.audit_logs
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);


-- ============================================================
-- 30. SERVICE ROLE
--
-- Supabase service_role BYPASSEA RLS.
--
-- n8n NO debe utilizar anon key.
--
-- Para n8n recomendamos:
--
--   SUPABASE_SERVICE_ROLE_KEY
--
-- almacenada EXCLUSIVAMENTE como credential/secret.
--
-- Nunca enviarla al frontend.
--
-- ============================================================


-- ============================================================
-- 31. FUNCIÓN SEGURA PARA CREAR USUARIO
--
-- Se ejecuta después de crear usuario en Supabase Auth.
--
-- Esta función NO acepta organization_id arbitrario desde
-- frontend.
--
-- En producción puedes crear organizaciones mediante backend
-- administrativo.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$

declare
    default_org uuid;

begin

    /*
     * Busca organización indicada en metadata.
     *
     * IMPORTANTE:
     * No debes confiar en esta estrategia para multi-tenancy
     * abierto al público.
     *
     * Para producción SaaS recomendamos controlar la invitación
     * desde backend.
     */

    default_org :=
        nullif(
            new.raw_user_meta_data ->> 'organization_id',
            ''
        )::uuid;

    if default_org is null then

        /*
         * No creamos organización automáticamente aquí.
         *
         * El usuario deberá ser provisionado por el sistema
         * administrativo.
         */

        return new;

    end if;


    insert into public.users (
        id,
        organization_id,
        full_name,
        email
    )

    values (
        new.id,
        default_org,
        new.raw_user_meta_data ->> 'full_name',
        new.email
    )

    on conflict (id) do nothing;


    return new;

end;

$$;


-- ============================================================
-- 32. TRIGGER AUTH USER
-- ============================================================

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created

after insert on auth.users

for each row

execute function public.handle_new_user();


-- ============================================================
-- 33. FUNCIÓN PARA REGISTRAR AUDITORÍA
-- ============================================================

create or replace function public.create_audit_log(
    p_organization_id uuid,
    p_event_type text,
    p_entity_type text default null,
    p_entity_id uuid default null,
    p_case_id uuid default null,
    p_action_id uuid default null,
    p_previous_data jsonb default null,
    p_new_data jsonb default null,
    p_metadata jsonb default '{}'::jsonb
)
returns uuid

language plpgsql

security definer

set search_path = public

as $$

declare
    audit_id uuid;

begin

    insert into public.audit_logs (
        organization_id,
        user_id,
        case_id,
        action_id,
        event_type,
        entity_type,
        entity_id,
        previous_data,
        new_data,
        metadata
    )

    values (
        p_organization_id,
        auth.uid(),
        p_case_id,
        p_action_id,
        p_event_type,
        p_entity_type,
        p_entity_id,
        p_previous_data,
        p_new_data,
        p_metadata
    )

    returning id into audit_id;

    return audit_id;

end;

$$;


-- ============================================================
-- 34. FUNCIÓN PARA VALIDAR QUE UNA ACCIÓN PERTENECE
-- AL MISMO TENANT QUE EL CASE
-- ============================================================

create or replace function public.validate_action_tenant()
returns trigger

language plpgsql

security invoker

set search_path = public

as $$

declare
    case_org uuid;

begin

    if new.case_id is null then
        return new;
    end if;


    select organization_id
    into case_org

    from public.cases

    where id = new.case_id;


    if case_org is null then

        raise exception 'Case does not exist';

    end if;


    if case_org <> new.organization_id then

        raise exception
            'Organization mismatch between action and case';

    end if;


    return new;

end;

$$;


drop trigger if exists trg_validate_action_tenant
on public.actions;

create trigger trg_validate_action_tenant

before insert or update

on public.actions

for each row

execute function public.validate_action_tenant();


-- ============================================================
-- 35. VALIDAR EMAIL / CASE / ORGANIZATION
-- ============================================================

create or replace function public.validate_email_tenant()
returns trigger

language plpgsql

security invoker

set search_path = public

as $$

declare
    case_org uuid;

begin

    if new.case_id is null then
        return new;
    end if;


    select organization_id
    into case_org

    from public.cases

    where id = new.case_id;


    if case_org <> new.organization_id then

        raise exception
            'Organization mismatch between email and case';

    end if;


    return new;

end;

$$;


drop trigger if exists trg_validate_email_tenant
on public.emails;

create trigger trg_validate_email_tenant

before insert or update

on public.emails

for each row

execute function public.validate_email_tenant();


-- ============================================================
-- 36. FUNCIÓN PARA OBTENER CASOS PENDIENTES
--
-- Útil para dashboard.
-- ============================================================

create or replace function public.get_pending_cases(
    p_limit integer default 50
)

returns setof public.cases

language sql

stable

security invoker

set search_path = public

as $$

    select c.*

    from public.cases c

    where c.organization_id =
          public.current_user_organization_id()

      and c.status in (
          'waiting_human',
          'waiting_approval',
          'follow_up',
          'waiting_verification'
      )

    order by

        case c.priority

            when 'critical' then 1
            when 'urgent' then 2
            when 'high' then 3
            when 'normal' then 4
            when 'low' then 5

        end,

        c.created_at asc

    limit greatest(1, least(p_limit, 100));

$$;


-- ============================================================
-- 37. FUNCIÓN PARA OBTENER APROBACIONES PENDIENTES
-- ============================================================

create or replace function public.get_pending_approvals(
    p_limit integer default 50
)

returns setof public.approvals

language sql

stable

security invoker

set search_path = public

as $$

    select a.*

    from public.approvals a

    where a.organization_id =
          public.current_user_organization_id()

      and a.status = 'pending'

      and (
          a.requested_from = auth.uid()
          or a.requested_from is null
      )

    order by a.requested_at asc

    limit greatest(1, least(p_limit, 100));

$$;


-- ============================================================
-- 38. SEGURIDAD DE FUNCIONES
-- ============================================================

revoke all
on function public.current_user_organization_id()
from public;

revoke all
on function public.current_user_role()
from public;

revoke all
on function public.is_org_admin()
from public;


grant execute
on function public.current_user_organization_id()
to authenticated;

grant execute
on function public.current_user_role()
to authenticated;

grant execute
on function public.is_org_admin()
to authenticated;


-- ============================================================
-- 39. COMENTARIOS DE SEGURIDAD
-- ============================================================

comment on table public.actions is
'Human/AI actions. Frontend may create actions but workflow execution should be handled by trusted backend/n8n.';

comment on table public.audit_logs is
'Immutable-style audit trail. Do not expose write permissions to normal authenticated users.';

comment on table public.workflow_executions is
'n8n execution tracking. Sensitive workflow payloads should not contain credentials or secrets.';

comment on table public.ai_runs is
'LLM execution metadata. Avoid storing sensitive prompts/responses unless required.';

comment on column public.actions.idempotency_key is
'Unique key preventing duplicate execution of the same logical action.';

comment on column public.external_references.external_id is
'External provider identifier such as Outlook message ID, Jira issue ID, etc.';


-- ============================================================
-- 40. REVOKE PUBLIC ACCESS
-- ============================================================

revoke all on all tables in schema public from anon;

revoke all on all sequences in schema public from anon;


-- ============================================================
-- FIN
-- ============================================================


-- ============================================================
-- NOTA DE SEGURIDAD PARA N8N
--
-- NO utilizar:
--
--   anon key
--   service role key en frontend
--   claves de Outlook en PostgreSQL
--   tokens de WhatsApp en PostgreSQL
--   API keys de Ollama/OpenAI/Anthropic en PostgreSQL
--
-- n8n debe usar una credencial segura.
--
-- El frontend solamente debe usar:
--
--   NEXT_PUBLIC_SUPABASE_URL
--   NEXT_PUBLIC_SUPABASE_ANON_KEY
--
-- El service role solamente:
--
--   servidor / n8n / backend confiable
--
-- ============================================================
-- 41. NOTIFICATIONS
-- ============================================================

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    user_id uuid references public.users(id) on delete cascade,
    notification_type text not null,
    title text not null,
    body text,
    entity_type text,
    entity_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    read_at timestamptz,
    created_at timestamptz not null default now(),
    constraint notifications_type_check check (
        notification_type in (
            'approval_required', 'urgent_case', 'workflow_failed',
            'follow_up_due', 'delegation_received', 'customer_replied',
            'system_error'
        )
    )
);

create index if not exists idx_notifications_user_unread
on public.notifications (organization_id, user_id, created_at desc)
where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select
on public.notifications for select to authenticated
using (
    organization_id = public.current_user_organization_id()
    and (user_id = auth.uid() or user_id is null)
);

drop policy if exists notifications_update on public.notifications;
create policy notifications_update
on public.notifications for update to authenticated
using (
    organization_id = public.current_user_organization_id()
    and (user_id = auth.uid() or user_id is null)
)
with check (
    organization_id = public.current_user_organization_id()
    and (user_id = auth.uid() or user_id is null)
);

revoke all on public.notifications from anon;
grant select, update on public.notifications to authenticated;