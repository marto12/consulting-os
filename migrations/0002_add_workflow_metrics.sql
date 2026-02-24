ALTER TABLE workflow_templates
  ADD COLUMN practice_coverage jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN times_used integer NOT NULL DEFAULT 0,
  ADD COLUMN deployment_status text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN governance_maturity integer NOT NULL DEFAULT 1,
  ADD COLUMN baseline_cost real,
  ADD COLUMN ai_cost real,
  ADD COLUMN lifecycle_status text NOT NULL DEFAULT 'active',
  ADD COLUMN coming_soon_eta text;
