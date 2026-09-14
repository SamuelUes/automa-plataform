with action_workflows(action_type, workflow_code) as (
  values
    ('approve_email', 'PE07'),
    ('reject_approval', 'PE07'),
    ('delegate_case', 'PE04'),
    ('send_email', 'PE07'),
    ('schedule_follow_up', 'PE06'),
    ('resolve_case', 'PE12'),
    ('verify_case', 'PE12'),
    ('close_case', 'PE12')
)
update public.actions as a
set
  workflow_name = aw.workflow_code,
  workflow_id = (
    select wd.id
    from public.workflow_definitions as wd
    where wd.organization_id = a.organization_id
      and wd.code = aw.workflow_code
    limit 1
  )
from action_workflows as aw
where a.action_type = aw.action_type
  and exists (
    select 1
    from public.workflow_definitions as wd
    where wd.organization_id = a.organization_id
      and wd.code = aw.workflow_code
  );
