alter table public.remediation_attempts
  add column if not exists team_id text,
  add column if not exists team_name text;

create index if not exists remediation_attempts_team_idx
  on public.remediation_attempts (team_id, created_at desc);