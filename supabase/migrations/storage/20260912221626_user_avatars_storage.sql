-- Active: 1789052866193@@db.aqackcsunogyyyhclixh.supabase.co@5432@postgres@storage
-- User avatars storage contract.
-- Public bucket for avatar images, scoped per-organization.
-- Storage path convention: <organization_id>/<user_id>/<filename>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'avatars',
    'avatars',
    true,
    2097152,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
    name = excluded.name,
    public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Add auth_provider column to public.users to track the primary auth provider.
alter table public.users
    add column if not exists auth_provider text not null default 'email';

comment on column public.users.auth_provider is 'Primary authentication provider: email, google, github, etc.';

-- Ensure auth_provider is a non-empty trimmed string.
alter table public.users
    add constraint users_auth_provider_check
    check (char_length(trim(auth_provider)) >= 1);

-- Update existing rows to use the default.
update public.users set auth_provider = 'email' where auth_provider is null or trim(auth_provider) = '';

-- ============================================================================
-- Storage RLS policies for the avatars bucket.
-- Path convention: <organization_id>/<user_id>/<filename>
-- ============================================================================

drop policy if exists avatars_storage_select on storage.objects;
create policy avatars_storage_select
on storage.objects
for select
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
);

drop policy if exists avatars_storage_insert on storage.objects;
create policy avatars_storage_insert
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
);

drop policy if exists avatars_storage_update on storage.objects;
create policy avatars_storage_update
on storage.objects
for update
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
)
with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
);

drop policy if exists avatars_storage_delete on storage.objects;
create policy avatars_storage_delete
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
);

-- Admins can manage any avatar in their organization (for invite_user setup).
drop policy if exists avatars_storage_admin_manage on storage.objects;
create policy avatars_storage_admin_manage
on storage.objects
for all
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
    and public.is_org_admin()
)
with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
    and public.is_org_admin()
);
