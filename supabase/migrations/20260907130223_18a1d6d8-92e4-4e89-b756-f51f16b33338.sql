ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_meter_event_name text DEFAULT 'harness.usage';

ALTER TABLE public.usage_meters
  ADD COLUMN IF NOT EXISTS unit_cost_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_meter_event_name text;

UPDATE public.usage_meters
SET unit_cost_usd = CASE name
  WHEN 'runs' THEN 0.01
  WHEN 'tokens' THEN 0.000001
  WHEN 'cost_usd' THEN 1
  ELSE 0
END;

CREATE TABLE IF NOT EXISTS public.billing_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  meter_name text NOT NULL CHECK (meter_name IN ('seats', 'runs', 'tokens', 'cost_usd')),
  delta numeric NOT NULL DEFAULT 0,
  description text,
  source_run_id uuid,
  stripe_event_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_usage_events_user_created_idx
  ON public.billing_usage_events (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.billing_usage_events TO authenticated;
GRANT ALL ON public.billing_usage_events TO service_role;

ALTER TABLE public.billing_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage events"
ON public.billing_usage_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage events"
ON public.billing_usage_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);