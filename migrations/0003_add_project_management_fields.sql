ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS governance_controls jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_savings_to_date real,
  ADD COLUMN IF NOT EXISTS cost_reduction_realised_pct real,
  ADD COLUMN IF NOT EXISTS margin_impact_to_date real,
  ADD COLUMN IF NOT EXISTS projected_annual_impact real;

ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS subtitle text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS depends_on jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gate_json jsonb,
  ADD COLUMN IF NOT EXISTS execution_json jsonb;
