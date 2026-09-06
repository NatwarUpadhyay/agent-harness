-- Allow invitees to accept invitations sent to their email address.
CREATE POLICY "Invitees can accept their own invitations"
ON public.team_invitations
FOR UPDATE
TO authenticated
USING (lower(email) = lower(auth.email()))
WITH CHECK (lower(email) = lower(auth.email()) AND status = 'accepted');

-- Allow invitees to join a team when they have an accepted invitation.
CREATE POLICY "Invitees can join as team member"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.team_invitations i
    WHERE lower(i.email) = lower(auth.email())
      AND i.status = 'accepted'
      AND i.expires_at > now()
  )
);

-- Update the signup trigger to store the invitee's email so they don't show as "Unknown member".
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
  SELECT i.owner_id, new.id, i.role, i.email
  FROM public.team_invitations i
  WHERE lower(i.email) = lower(new.email)
    AND i.status = 'accepted'
  ON CONFLICT (owner_id, user_id) DO NOTHING;

  RETURN new;
END;
$$;

-- Backfill any existing team member rows that are missing an email.
UPDATE public.team_members m
SET email = u.email
FROM auth.users u
WHERE m.user_id = u.id
  AND m.email IS NULL;