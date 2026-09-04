create table if not exists public.rate_limits (
    key text primary key,
    window_started_at timestamptz not null default now(),
    request_count integer not null default 0,
    constraint rate_limits_count_nonnegative check (request_count >= 0)
);

revoke all on public.rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(
    p_key text,
    p_limit integer default 60,
    p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    current_count integer;
    current_window timestamptz;
begin
    if auth.uid() is null or p_key is null or p_limit < 1 then
        return false;
    end if;

    insert into public.rate_limits (key, window_started_at, request_count)
    values (p_key, now(), 1)
    on conflict (key) do update
    set
        window_started_at = case
            when public.rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now()
                then now()
            else public.rate_limits.window_started_at
        end,
        request_count = case
            when public.rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now()
                then 1
            else public.rate_limits.request_count + 1
        end
    returning request_count, window_started_at
    into current_count, current_window;

    return current_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;
