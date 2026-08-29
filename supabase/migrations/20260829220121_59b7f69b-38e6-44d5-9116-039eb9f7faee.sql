CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Starter',
  price_usd numeric NOT NULL DEFAULT 0,
  billing_interval text NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'annual')),
  limits jsonb NOT NULL DEFAULT '{"seats": 1, "runs_per_month": 100, "tokens_per_month": 100000, "cost_usd_per_month": 100}'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_plans TO authenticated;
GRANT ALL ON public.billing_plans TO service_role;

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own billing plan"
ON public.billing_plans
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.usage_meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (name IN ('seats', 'runs', 'tokens', 'cost_usd')),
  current_value numeric NOT NULL DEFAULT 0,
  limit_value numeric NOT NULL DEFAULT 0,
  period_start timestamp with time zone NOT NULL DEFAULT now(),
  period_end timestamp with time zone NOT NULL DEFAULT (now() + interval '1 month'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_meters TO authenticated;
GRANT ALL ON public.usage_meters TO service_role;

ALTER TABLE public.usage_meters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own usage meters"
ON public.usage_meters
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_billing_plans_updated_at
BEFORE UPDATE ON public.billing_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_usage_meters_updated_at
BEFORE UPDATE ON public.usage_meters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();