ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS email text;

UPDATE public.team_members m
SET email = i.email
FROM public.team_invitations i
WHERE m.user_id = (
  SELECT u.id FROM auth.users u WHERE lower(u.email) = lower(i.email)
)
AND m.email IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.team_members TO authenticated;