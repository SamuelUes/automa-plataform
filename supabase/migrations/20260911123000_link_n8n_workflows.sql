update public.workflow_definitions
set n8n_workflow_id = case code
    when 'PE01' then '84hWG4KDG6fuZCKk'
    when 'PE03' then 'FiN86kVzphFQeFP8'
    when 'PE05' then '52haTE8AfCfhhzlp'
    when 'PE07' then 'cC76MFgF0omF0kuh'
    when 'PE08' then 'BuFaP3nCOrFNV0Wt'
    when 'PE10' then '117KXgEKcwrh1yrU'
    else n8n_workflow_id
end
where n8n_workflow_id is null
  and code in ('PE01', 'PE03', 'PE05', 'PE07', 'PE08', 'PE10');
