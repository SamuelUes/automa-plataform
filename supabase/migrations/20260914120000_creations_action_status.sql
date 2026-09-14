-- Align creations lifecycle with the shared action_status contract.
alter table public.creations
drop constraint if exists creations_status_valid;

alter table public.creations
alter column status drop default;

alter table public.creations
alter column status type public.action_status
using (
    case status::text
        when 'requested' then 'queued'::public.action_status
        when 'processing' then 'running'::public.action_status
        when 'ready' then 'completed'::public.action_status
        when 'discarded' then 'cancelled'::public.action_status
        else status::text::public.action_status
    end
);

alter table public.creations
alter column status set default 'queued'::public.action_status;
