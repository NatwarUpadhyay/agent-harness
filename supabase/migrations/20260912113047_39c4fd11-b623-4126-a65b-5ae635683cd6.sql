ALTER TABLE public.team_invitations DROP CONSTRAINT IF EXISTS team_invitations_role_check;
ALTER TABLE public.team_invitations ADD CONSTRAINT team_invitations_role_check
  CHECK (role IN ('admin', 'operator', 'analyst', 'viewer'));

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

  INSERT INTO public.team_members (owner_id, user_id, role, email)
  SELECT i.owner_id,
         new.id,
         CASE
           WHEN i.role = 'admin' THEN 'admin'
           WHEN i.role = 'viewer' THEN 'viewer'
           ELSE 'member'
         END,
         i.email
  FROM public.team_invitations i
  WHERE lower(i.email) = lower(new.email)
    AND i.status = 'accepted'
    AND i.expires_at > now()
  ON CONFLICT (owner_id, user_id) DO NOTHING;

  RETURN new;
END;
$$;

DROP POLICY IF EXISTS "Invitees can join as team member" ON public.team_members;

CREATE POLICY "Invitees can join as team member"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.team_invitations i
    WHERE lower(i.email) = lower(auth.email())
      AND i.owner_id = team_members.owner_id
      AND i.status = 'accepted'
      AND i.expires_at > now()
      AND CASE
            WHEN i.role = 'admin' THEN 'admin'
            WHEN i.role = 'viewer' THEN 'viewer'
            ELSE 'member'
          END = team_members.role
  )
);