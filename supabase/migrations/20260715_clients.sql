-- ============================================================
-- FASE 5 — CLIENTES
-- Rodar DEPOIS de 20260710_workspaces.sql e ANTES do deploy da fase 5.
-- ============================================================
begin;

create table if not exists clients (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  company      text,
  email        text,
  phone        text,
  notes        text not null default '',
  color        text not null default '#8b5cf6',
  archived     boolean not null default false,
  created_by   uuid references auth.users(id),
  user_id      uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index if not exists clients_workspace_idx on clients(workspace_id);

alter table tasks  add column if not exists client_id uuid references clients(id) on delete set null;
alter table blocks add column if not exists client_id uuid references clients(id) on delete set null;
create index if not exists tasks_client_idx  on tasks(client_id);
create index if not exists blocks_client_idx on blocks(client_id);

alter table clients enable row level security;

-- Todos os membros do workspace leem; admin/gestor criam e editam; admin exclui
drop policy if exists clients_select on clients;
drop policy if exists clients_insert on clients;
drop policy if exists clients_update on clients;
drop policy if exists clients_delete on clients;
create policy clients_select on clients for select to authenticated
  using (workspace_id in (select my_workspaces()));
create policy clients_insert on clients for insert to authenticated
  with check (workspace_id in (select my_workspaces()) and my_role(workspace_id) in ('admin','manager'));
create policy clients_update on clients for update to authenticated
  using (workspace_id in (select my_workspaces()) and my_role(workspace_id) in ('admin','manager'));
create policy clients_delete on clients for delete to authenticated
  using (workspace_id in (select my_workspaces()) and my_role(workspace_id) = 'admin');

drop trigger if exists clients_defaults on clients;
create trigger clients_defaults before insert on clients
  for each row execute function set_row_defaults();

commit;
