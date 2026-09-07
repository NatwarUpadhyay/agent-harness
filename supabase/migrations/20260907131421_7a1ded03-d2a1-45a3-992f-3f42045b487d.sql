-- Bind the policy comparison to the row being inserted by qualifying with the table name.
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
      AND i.role = team_members.role
  )
);