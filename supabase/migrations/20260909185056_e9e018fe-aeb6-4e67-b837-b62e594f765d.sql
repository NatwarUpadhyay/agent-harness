CREATE TABLE public.billing_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  secret text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_webhooks TO authenticated;
GRANT ALL ON public.billing_webhooks TO service_role;

ALTER TABLE public.billing_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own billing webhooks"
ON public.billing_webhooks
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_billing_webhooks_updated_at
BEFORE UPDATE ON public.billing_webhooks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();