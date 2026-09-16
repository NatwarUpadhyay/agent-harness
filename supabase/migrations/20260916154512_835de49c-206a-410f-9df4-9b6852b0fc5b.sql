CREATE TABLE IF NOT EXISTS public.integration_secrets (
  integration_id UUID PRIMARY KEY REFERENCES public.integrations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_secrets TO authenticated;
GRANT ALL ON public.integration_secrets TO service_role;

ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace owner can manage integration secrets" ON public.integration_secrets;
CREATE POLICY "Workspace owner can manage integration secrets"
  ON public.integration_secrets FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

INSERT INTO public.integration_secrets (integration_id, owner_id, api_key)
SELECT i.id, i.owner_id, i.api_key FROM public.integrations i
WHERE i.api_key IS NOT NULL
ON CONFLICT (integration_id) DO NOTHING;

ALTER TABLE public.integrations DROP COLUMN IF EXISTS api_key;