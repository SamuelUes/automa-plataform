-- Private Storage bucket for generated creations.
-- Path convention: <organization_id>/<creation_id>/<safe-filename>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'creations',
    'creations',
    false,
    26214400,
    array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'image/png',
        'image/jpeg',
        'image/webp'
    ]::text[]
)
on conflict (id) do update
set
    name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists creations_storage_select on storage.objects;
create policy creations_storage_select
on storage.objects
for select to authenticated
using (
    bucket_id = 'creations'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
);

drop policy if exists creations_storage_insert on storage.objects;
create policy creations_storage_insert
on storage.objects
for insert to authenticated
with check (
    bucket_id = 'creations'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
    and (storage.foldername(name))[2] is not null
);

drop policy if exists creations_storage_update on storage.objects;
create policy creations_storage_update
on storage.objects
for update to authenticated
using (
    bucket_id = 'creations'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
)
with check (
    bucket_id = 'creations'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
);

drop policy if exists creations_storage_delete on storage.objects;
create policy creations_storage_delete
on storage.objects
for delete to authenticated
using (
    bucket_id = 'creations'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
    and public.is_org_admin()
);

