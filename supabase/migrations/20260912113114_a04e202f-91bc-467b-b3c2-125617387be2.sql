ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.workflows SET owner_id = user_id WHERE owner_id IS NULL;
ALTER TABLE public.workflows ALTER COLUMN owner_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS workflows_owner_id_idx ON public.workflows(owner_id);

ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.workflow_runs SET owner_id = user_id WHERE owner_id IS NULL;
ALTER TABLE public.workflow_runs ALTER COLUMN owner_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS workflow_runs_owner_id_idx ON public.workflow_runs(owner_id);

DROP POLICY IF EXISTS "Users manage own workflows" ON public.workflows;
CREATE POLICY "Workspace members can view workflows"
ON public.workflows
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.owner_id = workflows.owner_id AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owner can manage workflows"
ON public.workflows
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users manage own workflow runs" ON public.workflow_runs;
CREATE POLICY "Workspace members can view workflow runs"
ON public.workflow_runs
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.owner_id = workflow_runs.owner_id AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owner can manage workflow runs"
ON public.workflow_runs
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] NOT NULL DEFAULT '{}',
  versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts TO authenticated;
GRANT ALL ON public.prompts TO service_role;

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view prompts"
ON public.prompts
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.owner_id = prompts.owner_id AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owner can manage prompts"
ON public.prompts
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE INDEX prompts_owner_id_idx ON public.prompts(owner_id);
CREATE INDEX prompts_category_idx ON public.prompts(category);

CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON public.prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
