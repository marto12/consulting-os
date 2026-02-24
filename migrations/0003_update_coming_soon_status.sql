UPDATE workflow_templates
SET deployment_status = 'planned'
WHERE lifecycle_status = 'coming_soon'
  AND deployment_status = 'coming_soon';
