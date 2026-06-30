-- Eisenhower Tasks — Supabase schema
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- Tasks
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  urgent      boolean not null default false,
  important   boolean not null default false,
  quadrant    text not null default 'q4',
  status      text not null default 'pending',
  due_date    date,
  category    text not null default 'geral',
  delegated_to text,
  created_at  timestamptz not null default now()
);

-- People
create table if not exists people (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text,
  sector     text,
  hierarchy  text,
  "slackId"  text,
  whatsapp   text,
  created_at timestamptz not null default now()
);

-- Agenda blocks
create table if not exists blocks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  task_id        uuid references tasks(id) on delete set null,
  date           date not null,
  start_time     text not null,
  end_time       text not null,
  color          text not null default 'blue',
  locked         boolean not null default false,
  recurrence     text,
  recurrence_end date,
  created_at     timestamptz not null default now()
);

-- Enable Row Level Security
alter table tasks  enable row level security;
alter table people enable row level security;
alter table blocks enable row level security;

-- Public access policies (single-user app — no auth required)
create policy "public access" on tasks  for all to anon using (true) with check (true);
create policy "public access" on people for all to anon using (true) with check (true);
create policy "public access" on blocks for all to anon using (true) with check (true);
