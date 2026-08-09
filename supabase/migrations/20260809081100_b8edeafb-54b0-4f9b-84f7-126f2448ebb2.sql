CREATE TABLE public.workflow_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  workflow_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  input TEXT NOT NULL DEFAULT '',
  output TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_runs TO authenticated;
GRANT ALL ON public.workflow_runs TO service_role;

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workflow runs"
ON public.workflow_runs FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX workflow_runs_user_created_idx ON public.workflow_runs (user_id, created_at DESC);

CREATE TRIGGER update_workflow_runs_updated_at
BEFORE UPDATE ON public.workflow_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();