CREATE TABLE public.eval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  dataset_name TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  pass_rate NUMERIC NOT NULL DEFAULT 0,
  cases INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  per_rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX eval_runs_owner_started_idx ON public.eval_runs (owner_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eval_runs TO authenticated;
GRANT ALL ON public.eval_runs TO service_role;

ALTER TABLE public.eval_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view eval runs"
ON public.eval_runs FOR SELECT TO authenticated
USING (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.owner_id = public.eval_runs.owner_id AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace members can create eval runs"
ON public.eval_runs FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.owner_id = public.eval_runs.owner_id AND tm.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Workspace owner can manage eval runs"
ON public.eval_runs FOR DELETE TO authenticated
USING (auth.uid() = owner_id);
