-- Active: 1787530257995@@aws-0-us-east-1.pooler.supabase.com@5432@postgres@public
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
            'approval_required',
            'urgent_case',
            'workflow_failed',
            'follow_up_due',
            'delegation_received',
            'customer_replied',
            'system_error'
        )
    )
);

create index if not exists idx_notifications_user_unread
on public.notifications (organization_id, user_id, created_at desc)
where read_at is null;

create index if not exists idx_notifications_created
on public.notifications (organization_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;

create policy notifications_select
on public.notifications
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
    and (user_id = auth.uid() or user_id is null)
);

drop policy if exists notifications_update on public.notifications;

create policy notifications_update
on public.notifications
for update
to authenticated
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
