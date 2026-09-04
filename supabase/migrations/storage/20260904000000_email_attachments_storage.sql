-- Email attachments storage contract.
-- This file is executable SQL, but it is intentionally NOT applied by the app.
-- Review against the target Supabase project before execution.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'email-attachments',
    'email-attachments',
    false,
    10485760,
    array[
        'application/pdf',
        'text/plain',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::text[]
)
on conflict (id) do update
set
    name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.email_attachments (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    email_id uuid not null references public.emails(id) on delete cascade,
    uploaded_by uuid not null references public.users(id) on delete restrict,
    storage_path text not null unique,
    original_name text not null,
    mime_type text not null,
    byte_size bigint not null,
    processing_status text not null default 'pending',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint email_attachments_size_check check (byte_size > 0 and byte_size <= 10485760),
    constraint email_attachments_status_check check (processing_status in ('pending', 'ready', 'rejected', 'failed')),
    constraint email_attachments_name_check check (char_length(trim(original_name)) between 1 and 255),
    constraint email_attachments_mime_check check (mime_type in (
        'application/pdf',
        'text/plain',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ))
);

create index if not exists email_attachments_email_idx
on public.email_attachments (organization_id, email_id, created_at desc);

create index if not exists email_attachments_uploader_idx
on public.email_attachments (organization_id, uploaded_by, created_at desc);

alter table public.email_attachments enable row level security;

revoke all on public.email_attachments from anon;
revoke all on public.email_attachments from authenticated;
grant select, insert, delete on public.email_attachments to authenticated;

drop policy if exists email_attachments_select on public.email_attachments;
create policy email_attachments_select
on public.email_attachments
for select
to authenticated
using (
    organization_id = public.current_user_organization_id()
);

drop policy if exists email_attachments_insert on public.email_attachments;
create policy email_attachments_insert
on public.email_attachments
for insert
to authenticated
with check (
    organization_id = public.current_user_organization_id()
    and uploaded_by = auth.uid()
);

drop policy if exists email_attachments_delete on public.email_attachments;
create policy email_attachments_delete
on public.email_attachments
for delete
to authenticated
using (
    organization_id = public.current_user_organization_id()
    and uploaded_by = auth.uid()
);

drop policy if exists email_attachments_storage_select on storage.objects;
create policy email_attachments_storage_select
on storage.objects
for select
to authenticated
using (
    bucket_id = 'email-attachments'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
);

drop policy if exists email_attachments_storage_insert on storage.objects;
create policy email_attachments_storage_insert
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'email-attachments'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
    and (storage.foldername(name))[2] is not null
);

drop policy if exists email_attachments_storage_delete on storage.objects;
create policy email_attachments_storage_delete
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'email-attachments'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
);

comment on table public.email_attachments is 'Private metadata for email attachments stored in the email-attachments bucket.';
comment on column public.email_attachments.storage_path is 'Private Storage object path: organization_id/email_id/attachment_id-safe_name.';
