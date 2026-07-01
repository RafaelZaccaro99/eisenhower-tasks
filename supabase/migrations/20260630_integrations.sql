-- calendar_integrations: one row per connected calendar/task-manager per user
create table if not exists calendar_integrations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null,   -- 'ical' | 'google' | 'clickup' | 'jira'
  name            text not null default '',
  color           text not null default '#60a5fa',
  access_token    text not null default '',  -- AES-256-GCM encrypted
  refresh_token   text not null default '',  -- AES-256-GCM encrypted
  expires_at      timestamptz,
  config          jsonb not null default '{}',  -- { ical_url, cloud_id, list_id, … }
  enabled         boolean not null default true,
  last_sync       timestamptz,
  created_at      timestamptz not null default now()
);

alter table calendar_integrations enable row level security;

create policy "users own their integrations"
  on calendar_integrations
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- external_events: normalized events pulled from external providers
create table if not exists external_events (
  id              uuid primary key default gen_random_uuid(),
  integration_id  uuid not null references calendar_integrations(id) on delete cascade,
  external_id     text not null,
  title           text not null default '',
  date            text not null,       -- YYYY-MM-DD
  start_time      text,                -- HH:MM or null (all-day)
  end_time        text,
  all_day         boolean not null default false,
  url             text not null default '',
  provider        text not null default '',
  created_at      timestamptz not null default now(),
  unique (integration_id, external_id)
);

alter table external_events enable row level security;

-- external_events RLS: access via join to calendar_integrations
create policy "users own their external events"
  on external_events
  for all
  using (
    integration_id in (
      select id from calendar_integrations where user_id = auth.uid()
    )
  )
  with check (
    integration_id in (
      select id from calendar_integrations where user_id = auth.uid()
    )
  );

-- indexes
create index if not exists external_events_integration_id_idx on external_events(integration_id);
create index if not exists external_events_date_idx on external_events(date);
create index if not exists calendar_integrations_user_id_idx on calendar_integrations(user_id);
