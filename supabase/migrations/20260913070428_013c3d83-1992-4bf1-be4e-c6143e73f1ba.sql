BEGIN;

ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.agents SET owner_id = user_id WHERE owner_id IS NULL;
ALTER TABLE public.agents ALTER COLUMN owner_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS agents_owner_id_idx ON public.agents(owner_id);

ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.tools SET owner_id = user_id WHERE owner_id IS NULL;
ALTER TABLE public.tools ALTER COLUMN owner_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS tools_owner_id_idx ON public.tools(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tools TO authenticated;
GRANT ALL ON public.tools TO service_role;

DROP POLICY IF EXISTS "Users manage own agents" ON public.agents;
DROP POLICY IF EXISTS "Workspace members can view agents" ON public.agents;
DROP POLICY IF EXISTS "Workspace owner can manage agents" ON public.agents;

CREATE POLICY "Workspace members can view agents"
ON public.agents
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.owner_id = agents.owner_id AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owner can manage agents"
ON public.agents
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users manage own tools" ON public.tools;
DROP POLICY IF EXISTS "Workspace members can view tools" ON public.tools;
DROP POLICY IF EXISTS "Workspace owner can manage tools" ON public.tools;

CREATE POLICY "Workspace members can view tools"
ON public.tools
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.owner_id = tools.owner_id AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owner can manage tools"
ON public.tools
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

WITH dups AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY owner_id, lower(name)
           ORDER BY updated_at DESC NULLS LAST
         ) AS rn
  FROM public.prompts
)
DELETE FROM public.prompts
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

ALTER TABLE public.prompts DROP CONSTRAINT IF EXISTS prompts_owner_name_unique;
ALTER TABLE public.prompts ADD CONSTRAINT prompts_owner_name_unique UNIQUE (owner_id, name);

COMMIT;
