CREATE TABLE public.remediation_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  workflow_id UUID,
  workflow_name TEXT,
  outcome TEXT NOT NULL,
  reason TEXT NOT NULL,
  human_initiated BOOLEAN NOT NULL DEFAULT false,
  run_id UUID,
  run_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX remediation_attempts_user_rule_idx ON public.remediation_attempts (user_id, rule_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.remediation_attempts TO authenticated;
GRANT ALL ON public.remediation_attempts TO service_role;

ALTER TABLE public.remediation_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own remediation attempts"
ON public.remediation_attempts FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);