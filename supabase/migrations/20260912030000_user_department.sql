-- Assign each user to a single department (nullable).
-- Consistent with the single department_id FK used on cases and delegations.

alter table public.users
  add column if not exists department_id uuid
    references public.departments(id) on delete set null;

create index if not exists users_department_id_idx
  on public.users (department_id)
  where department_id is not null;
