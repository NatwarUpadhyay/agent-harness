create or replace function public.set_team_budgets_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_team_budgets_updated_at() from anon, authenticated;
revoke all on function public.set_team_budgets_updated_at() from anon, authenticated;