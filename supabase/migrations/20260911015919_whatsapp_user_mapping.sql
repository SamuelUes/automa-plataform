-- Active: 1789052866193@@db.aqackcsunogyyyhclixh.supabase.co@5432@postgres@public
-- Associate an authorized platform user with an inbound Twilio WhatsApp number.
alter table public.users
  add column if not exists whatsapp_phone text;

create unique index if not exists users_organization_whatsapp_phone_idx
on public.users(organization_id, whatsapp_phone)
where whatsapp_phone is not null;

comment on column public.users.whatsapp_phone is
  'Normalized Twilio WhatsApp number in E.164 format, for example whatsapp:+5215555555555.';
