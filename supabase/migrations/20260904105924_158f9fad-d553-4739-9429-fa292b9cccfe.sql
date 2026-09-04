CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their team members"
ON public.team_members
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Members can view their own memberships"
ON public.team_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invitations TO authenticated;
GRANT ALL ON public.team_invitations TO service_role;

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their invitations"
ON public.team_invitations
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Invitees can view invitations sent to their email"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (lower(email) = lower(auth.email()));

CREATE OR REPLACE FUNCTION public.accept_team_invitations_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.team_invitations
  SET status = 'accepted', updated_at = now()
  WHERE lower(email) = lower(new.email)
    AND status = 'pending'
    AND expires_at > now();

  INSERT INTO public.team_members (owner_id, user_id, role)
  SELECT i.owner_id, new.id, i.role
  FROM public.team_invitations i
  WHERE lower(i.email) = lower(new.email)
    AND i.status = 'accepted'
  ON CONFLICT (owner_id, user_id) DO NOTHING;

  RETURN new;
END;
$$;

CREATE TRIGGER accept_team_invitations_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.accept_team_invitations_on_signup();

CREATE OR REPLACE FUNCTION public.set_team_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

CREATE TRIGGER team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.set_team_updated_at();

CREATE TRIGGER team_invitations_updated_at
BEFORE UPDATE ON public.team_invitations
FOR EACH ROW
EXECUTE FUNCTION public.set_team_updated_at();