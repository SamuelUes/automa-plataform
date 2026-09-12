create or replace function public.get_workflow_dashboard_stats(
    p_organization_id uuid,
    p_days integer default 30
)
returns table (
    workflow_id uuid,
    executions bigint,
    errors bigint,
    avg_duration_ms numeric,
    last_run timestamptz,
    last_status text,
    events bigint
)
language sql
stable
security invoker
set search_path = public
as $$
    with scoped_definitions as (
        select id, code
        from public.workflow_definitions
        where organization_id = p_organization_id
    ),
    scoped_executions as (
        select
            e.id as execution_id,
            coalesce(e.workflow_id, d.id) as workflow_id,
            e.status::text as status,
            e.started_at,
            e.finished_at
        from public.workflow_executions e
        left join scoped_definitions d
            on d.id = e.workflow_id
            or d.code = e.workflow_code
        where e.started_at >= now() - make_interval(days => greatest(p_days, 1))
          and (e.workflow_id in (select id from scoped_definitions)
            or e.workflow_code in (select code from scoped_definitions))
    ),
    execution_stats as (
        select
            workflow_id,
            count(*)::bigint as executions,
            count(*) filter (where status in ('failed', 'cancelled'))::bigint as errors,
            round(avg(extract(epoch from (finished_at - started_at)) * 1000) filter (where finished_at is not null), 2) as avg_duration_ms,
            max(started_at) as last_run
        from scoped_executions
        group by workflow_id
    ),
    latest_execution as (
        select distinct on (workflow_id)
            workflow_id,
            status as last_status
        from scoped_executions
        order by workflow_id, started_at desc
    ),
    event_stats as (
        select
            e.workflow_execution_id,
            count(*)::bigint as events
        from public.workflow_events e
        where e.organization_id = p_organization_id
          and e.created_at >= now() - make_interval(days => greatest(p_days, 1))
        group by e.workflow_execution_id
    ),
    workflow_event_totals as (
        select
            x.workflow_id,
            coalesce(sum(es.events), 0)::bigint as events
        from scoped_executions x
        left join event_stats es on es.workflow_execution_id = x.execution_id
        group by x.workflow_id
    )
    select
        d.id as workflow_id,
        coalesce(s.executions, 0)::bigint,
        coalesce(s.errors, 0)::bigint,
        s.avg_duration_ms,
        s.last_run,
        l.last_status,
        coalesce(et.events, 0)::bigint
    from scoped_definitions d
    left join execution_stats s on s.workflow_id = d.id
    left join latest_execution l on l.workflow_id = d.id
    left join workflow_event_totals et on et.workflow_id = d.id;
$$;

revoke all on function public.get_workflow_dashboard_stats(uuid, integer) from public;
grant execute on function public.get_workflow_dashboard_stats(uuid, integer) to authenticated;
