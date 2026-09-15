CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL,
  label TEXT,
  auth_type TEXT NOT NULL DEFAULT 'API key',
  api_key TEXT,
  key_last4 TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (owner_id, vendor)
);
CREATE INDEX integrations_owner_id_idx ON public.integrations(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can view integrations" ON public.integrations
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.owner_id = integrations.owner_id AND tm.user_id = auth.uid()));
CREATE POLICY "Workspace owner can manage integrations" ON public.integrations
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);