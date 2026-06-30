-- SLA: status_history migration
-- Run in Supabase SQL Editor after the main schema.sql

-- Table storing every status transition of a task
create table if not exists status_history (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  from_status text,                          -- null on first transition
  to_status   text not null,
  changed_at  timestamptz not null default now(),
  note        text not null default '',
  user_id     uuid references auth.users(id)
);

-- Indexes for fast task lookups and time-range queries
create index if not exists status_history_task_id_idx  on status_history(task_id);
create index if not exists status_history_changed_at_idx on status_history(changed_at);

-- RLS
alter table status_history enable row level security;

create policy "authenticated user history" on status_history
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "anon access" on status_history
  for all to anon
  using (true)
  with check (true);

-- Valid status values (comment only — tasks.status is text, no enum constraint):
-- pending | in_progress | review | blocked | completed | cancelled
