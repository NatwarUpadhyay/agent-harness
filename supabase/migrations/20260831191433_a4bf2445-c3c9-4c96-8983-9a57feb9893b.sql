DELETE FROM public.billing_plans p
USING public.billing_plans q
WHERE p.user_id = q.user_id AND p.created_at > q.created_at;

DELETE FROM public.billing_plans p
USING public.billing_plans q
WHERE p.user_id = q.user_id AND p.created_at = q.created_at AND p.id > q.id;

CREATE UNIQUE INDEX IF NOT EXISTS billing_plans_user_id_key ON public.billing_plans (user_id);