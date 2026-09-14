-- Active: 1789052866193@@db.aqackcsunogyyyhclixh.supabase.co@5432@postgres@public
alter table public.emails
  add column if not exists evaluation text not null default 'normal';

update public.emails
set evaluation = case
  when lower(coalesce(metadata->>'priority', metadata->>'importance', 'normal')) in ('low', 'normal', 'high', 'urgent', 'critical')
    then lower(coalesce(metadata->>'priority', metadata->>'importance', 'normal'))
  else 'normal'
end;

alter table public.emails
  drop constraint if exists emails_evaluation_check;

alter table public.emails
  add constraint emails_evaluation_check
  check (evaluation in ('low', 'normal', 'high', 'urgent', 'critical'));

create index if not exists idx_emails_evaluation
  on public.emails(organization_id, evaluation);
