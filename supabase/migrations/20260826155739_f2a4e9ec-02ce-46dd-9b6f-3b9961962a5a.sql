create table public.team_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  team text not null,
  cap numeric not null default 0,
  spent numeric not null default 0,
  enforcement text not null default 'notify',
  active boolean not null default true,
  period text not null default 'monthly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, team)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_budgets TO authenticated;
GRANT ALL ON public.team_budgets TO service_role;

ALTER TABLE public.team_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own team budgets"
  ON public.team_budgets
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

create or replace function public.set_team_budgets_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger team_budgets_updated_at
  before update on public.team_budgets
  for each row
  execute function public.set_team_budgets_updated_at();
