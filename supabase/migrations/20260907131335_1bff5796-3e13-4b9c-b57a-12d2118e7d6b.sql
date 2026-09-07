-- Strengthen the invitee INSERT policy so the inserted role must match the accepted invitation.
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
      AND i.owner_id = owner_id
      AND i.status = 'accepted'
      AND i.expires_at > now()
      AND i.role = role
  )
);