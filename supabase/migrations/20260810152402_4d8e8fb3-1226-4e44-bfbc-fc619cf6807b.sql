CREATE TABLE public.workflow_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  workflow_id UUID NOT NULL,
  workflow_name TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger_kind TEXT NOT NULL DEFAULT 'recurring',
  recurrence TEXT NOT NULL DEFAULT 'hourly',
  input TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  webhook_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workflow_schedules_trigger_kind_check CHECK (trigger_kind IN ('recurring','webhook')),
  CONSTRAINT workflow_schedules_recurrence_check CHECK (recurrence IN ('every_15m','hourly','every_6h','daily','weekly'))
);

CREATE UNIQUE INDEX workflow_schedules_webhook_token_idx ON public.workflow_schedules (webhook_token);
CREATE INDEX workflow_schedules_due_idx ON public.workflow_schedules (enabled, next_run_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_schedules TO authenticated;
GRANT ALL ON public.workflow_schedules TO service_role;

ALTER TABLE public.workflow_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own schedules"
  ON public.workflow_schedules FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_workflow_schedules_updated_at
  BEFORE UPDATE ON public.workflow_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();