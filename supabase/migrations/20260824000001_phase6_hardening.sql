-- Active: 1787530257995@@aws-0-us-east-1.pooler.supabase.com@5432@postgres@public
-- Policies needed for human decisions and operational ownership changes.
-- Every policy remains tenant-scoped through current_user_organization_id().

drop policy if exists approvals_update_requester on public.approvals;

create policy approvals_update_requester
on public.approvals
for update
to authenticated
using (
    organization_id = public.current_user_organization_id()
    and (requested_from = auth.uid() or requested_from is null)
)
with check (
    organization_id = public.current_user_organization_id()
);

drop policy if exists delegations_insert_authorized on public.delegations;

create policy delegations_insert_authorized
on public.delegations
for insert
to authenticated
with check (
    organization_id = public.current_user_organization_id()
    and assigned_by = auth.uid()
);

drop policy if exists delegations_update_authorized on public.delegations;

create policy delegations_update_authorized
on public.delegations
for update
to authenticated
using (
    organization_id = public.current_user_organization_id()
    and (assigned_by = auth.uid() or assigned_to = auth.uid() or public.is_org_admin())
)
with check (
    organization_id = public.current_user_organization_id()
);

drop policy if exists followups_insert_authorized on public.follow_ups;

create policy followups_insert_authorized
on public.follow_ups
for insert
to authenticated
with check (
    organization_id = public.current_user_organization_id()
);

drop policy if exists followups_update_authorized on public.follow_ups;

create policy followups_update_authorized
on public.follow_ups
for update
to authenticated
using (
    organization_id = public.current_user_organization_id()
)
with check (
    organization_id = public.current_user_organization_id()
);

-- User preferences are updated only by the user through the secure function.
drop policy if exists users_self_update_preferences on public.users;

create policy users_self_update_preferences
on public.users
for update
to authenticated
using (
    id = auth.uid()
    and organization_id = public.current_user_organization_id()
)
with check (
    id = auth.uid()
    and organization_id = public.current_user_organization_id()
);
