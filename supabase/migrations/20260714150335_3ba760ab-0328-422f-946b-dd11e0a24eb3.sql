alter table public.workflows add column if not exists is_public boolean not null default false;
create index if not exists workflows_is_public_idx on public.workflows (is_public) where is_public = true;
grant select on public.workflows to anon;
drop policy if exists "Public workflows are viewable by anyone" on public.workflows;
create policy "Public workflows are viewable by anyone"
  on public.workflows for select
  to anon, authenticated
  using (is_public = true);