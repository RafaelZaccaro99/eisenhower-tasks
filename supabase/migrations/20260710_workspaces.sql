-- ============================================================
-- FASE 4 — MULTI-TENANT: workspaces, membros, papéis, convites
--
-- PRÉ-REQUISITO OBRIGATÓRIO:
--   Supabase → Authentication → Sign In / Providers → "Confirm email" LIGADO.
--   Sem isso, qualquer pessoa pode se cadastrar com e-mail alheio e herdar
--   convites pendentes daquele e-mail.
--
-- Rodar ANTES do deploy do frontend da fase 4.
-- O frontend antigo continua funcionando após esta migração:
--   - triggers BEFORE INSERT preenchem workspace_id/created_by/assigned_to
--   - policies de tasks mantêm o caminho legado user_id = auth.uid()
-- ============================================================
begin;

-- 1) Tabelas ---------------------------------------------------
create table if not exists workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Meu workspace',
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade, -- null enquanto convite pendente
  invited_email text,
  role          text not null default 'member' check (role in ('admin','manager','member')),
  status        text not null default 'active' check (status in ('invited','active')),
  invited_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create unique index if not exists wm_ws_user_uq  on workspace_members(workspace_id, user_id) where user_id is not null;
create unique index if not exists wm_ws_email_uq on workspace_members(workspace_id, lower(invited_email)) where status = 'invited';
create index if not exists wm_user_idx on workspace_members(user_id);

-- 2) Helpers SECURITY DEFINER (evitam recursão de RLS) ---------
create or replace function my_workspaces()
returns setof uuid language sql stable security definer set search_path = public as $$
  select workspace_id from workspace_members
  where user_id = auth.uid() and status = 'active'
$$;

create or replace function my_role(ws uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from workspace_members
  where workspace_id = ws and user_id = auth.uid() and status = 'active'
  limit 1
$$;

revoke all on function my_workspaces() from public;
revoke all on function my_role(uuid) from public;
grant execute on function my_workspaces() to authenticated;
grant execute on function my_role(uuid) to authenticated;

-- 3) Colunas novas nas tabelas existentes ----------------------
alter table tasks  add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table tasks  add column if not exists assigned_to  uuid references auth.users(id) on delete set null;
alter table tasks  add column if not exists created_by   uuid references auth.users(id);
alter table people add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table blocks add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table status_history add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

create index if not exists tasks_workspace_idx  on tasks(workspace_id);
create index if not exists tasks_assigned_idx   on tasks(assigned_to);
create index if not exists people_workspace_idx on people(workspace_id);
create index if not exists blocks_workspace_idx on blocks(workspace_id);
create index if not exists sh_workspace_idx     on status_history(workspace_id);

-- 4) Backfill: cada usuário existente vira um workspace próprio
insert into workspaces (name, owner_id)
select coalesce(nullif(u.raw_user_meta_data->>'name',''), split_part(u.email,'@',1)), u.id
from auth.users u
where not exists (select 1 from workspaces w where w.owner_id = u.id);

insert into workspace_members (workspace_id, user_id, role, status)
select w.id, w.owner_id, 'admin', 'active'
from workspaces w
where not exists (
  select 1 from workspace_members m where m.workspace_id = w.id and m.user_id = w.owner_id
);

update tasks t
   set workspace_id = w.id,
       created_by   = coalesce(t.created_by, t.user_id),
       assigned_to  = coalesce(t.assigned_to, t.user_id)
  from workspaces w
 where w.owner_id = t.user_id and t.workspace_id is null;

update people p set workspace_id = w.id from workspaces w
 where w.owner_id = p.user_id and p.workspace_id is null;

update blocks b set workspace_id = w.id from workspaces w
 where w.owner_id = b.user_id and b.workspace_id is null;

update status_history s set workspace_id = w.id from workspaces w
 where w.owner_id = s.user_id and s.workspace_id is null;

-- 5) Triggers de default (SEM security definer — ver fix_rls_complete.sql:
--    trigger security definer zera auth.uid() neste projeto)
create or replace function set_row_defaults()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then new.user_id := auth.uid(); end if;
  if new.workspace_id is null then
    select workspace_id into new.workspace_id
      from workspace_members
     where user_id = auth.uid() and status = 'active'
     order by created_at asc limit 1;
  end if;
  return new;
end $$;

create or replace function set_task_defaults()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then new.user_id := auth.uid(); end if;
  if new.workspace_id is null then
    select workspace_id into new.workspace_id
      from workspace_members
     where user_id = auth.uid() and status = 'active'
     order by created_at asc limit 1;
  end if;
  if new.created_by  is null then new.created_by  := auth.uid(); end if;
  if new.assigned_to is null then new.assigned_to := auth.uid(); end if;
  return new;
end $$;

drop trigger if exists tasks_defaults  on tasks;
drop trigger if exists people_defaults on people;
drop trigger if exists blocks_defaults on blocks;
drop trigger if exists sh_defaults     on status_history;
create trigger tasks_defaults  before insert on tasks  for each row execute function set_task_defaults();
create trigger people_defaults before insert on people for each row execute function set_row_defaults();
create trigger blocks_defaults before insert on blocks for each row execute function set_row_defaults();
create trigger sh_defaults     before insert on status_history for each row execute function set_row_defaults();

-- 6) RLS -------------------------------------------------------
alter table workspaces        enable row level security;
alter table workspace_members enable row level security;

drop policy if exists ws_select on workspaces;
drop policy if exists ws_insert on workspaces;
drop policy if exists ws_update on workspaces;
drop policy if exists ws_delete on workspaces;
create policy ws_select on workspaces for select to authenticated
  using (id in (select my_workspaces()) or owner_id = (select auth.uid()));
create policy ws_insert on workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy ws_update on workspaces for update to authenticated
  using (my_role(id) = 'admin');
create policy ws_delete on workspaces for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists wm_select on workspace_members;
drop policy if exists wm_insert on workspace_members;
drop policy if exists wm_update on workspace_members;
drop policy if exists wm_delete on workspace_members;
create policy wm_select on workspace_members for select to authenticated
  using (workspace_id in (select my_workspaces()));
create policy wm_insert on workspace_members for insert to authenticated
  with check (my_role(workspace_id) = 'admin');
create policy wm_update on workspace_members for update to authenticated
  using (my_role(workspace_id) = 'admin');
create policy wm_delete on workspace_members for delete to authenticated
  using (my_role(workspace_id) = 'admin' or user_id = (select auth.uid())); -- sair do workspace

-- TASKS: gestor/admin veem tudo; membro vê as suas -------------
drop policy if exists "user access" on tasks;
drop policy if exists tasks_select on tasks;
drop policy if exists tasks_insert on tasks;
drop policy if exists tasks_update on tasks;
drop policy if exists tasks_delete on tasks;
create policy tasks_select on tasks for select to authenticated using (
  workspace_id in (select my_workspaces())
  and (
    my_role(workspace_id) in ('admin','manager')
    or assigned_to = (select auth.uid())
    or created_by  = (select auth.uid())
    or user_id     = (select auth.uid())   -- caminho legado
  )
);
create policy tasks_insert on tasks for insert to authenticated with check (
  workspace_id in (select my_workspaces())
  and created_by = (select auth.uid())
);
create policy tasks_update on tasks for update to authenticated using (
  workspace_id in (select my_workspaces())
  and (
    my_role(workspace_id) in ('admin','manager')
    or assigned_to = (select auth.uid())
    or created_by  = (select auth.uid())
    or user_id     = (select auth.uid())
  )
) with check (workspace_id in (select my_workspaces()));
create policy tasks_delete on tasks for delete to authenticated using (
  workspace_id in (select my_workspaces())
  and (
    my_role(workspace_id) in ('admin','manager')
    or created_by = (select auth.uid())
    or user_id    = (select auth.uid())
  )
);

-- PEOPLE (contatos): compartilhados por todo o workspace -------
drop policy if exists "user access" on people;
drop policy if exists people_all on people;
create policy people_all on people for all to authenticated
  using (workspace_id in (select my_workspaces()))
  with check (workspace_id in (select my_workspaces()));

-- BLOCKS (agenda): dono sempre; gestor/admin leem a agenda do time
drop policy if exists "user access" on blocks;
drop policy if exists blocks_select on blocks;
drop policy if exists blocks_write  on blocks;
drop policy if exists blocks_update on blocks;
drop policy if exists blocks_delete on blocks;
create policy blocks_select on blocks for select to authenticated using (
  workspace_id in (select my_workspaces())
  and (user_id = (select auth.uid()) or my_role(workspace_id) in ('admin','manager'))
);
create policy blocks_write on blocks for insert to authenticated with check (
  workspace_id in (select my_workspaces()) and user_id = (select auth.uid())
);
create policy blocks_update on blocks for update to authenticated using (
  workspace_id in (select my_workspaces())
  and (user_id = (select auth.uid()) or my_role(workspace_id) in ('admin','manager'))
);
create policy blocks_delete on blocks for delete to authenticated using (
  workspace_id in (select my_workspaces()) and user_id = (select auth.uid())
);

-- STATUS_HISTORY: visibilidade herdada da task -----------------
drop policy if exists "authenticated user history" on status_history;
drop policy if exists "anon access" on status_history;
drop policy if exists sh_select on status_history;
drop policy if exists sh_insert on status_history;
create policy sh_select on status_history for select to authenticated
  using (exists (select 1 from tasks t where t.id = status_history.task_id));
create policy sh_insert on status_history for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from tasks t where t.id = status_history.task_id)
  );

-- 7) RPCs de fluxo ---------------------------------------------
create or replace function accept_pending_invites()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update workspace_members wm
     set user_id = auth.uid(), status = 'active'
   where wm.status = 'invited'
     and wm.user_id is null
     and lower(wm.invited_email) = lower(coalesce(auth.jwt()->>'email',''))
     and not exists (
       select 1 from workspace_members m2
        where m2.workspace_id = wm.workspace_id
          and m2.user_id = auth.uid() and m2.status = 'active'
     );
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function bootstrap_workspace()
returns table (workspace_id uuid, workspace_name text, role text, member_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  perform accept_pending_invites();
  if not exists (select 1 from workspace_members m
                  where m.user_id = auth.uid() and m.status = 'active') then
    if not exists (select 1 from workspaces w where w.owner_id = auth.uid()) then
      insert into workspaces (name, owner_id)
      values (coalesce(nullif(auth.jwt()->'user_metadata'->>'name',''),
                       split_part(coalesce(auth.jwt()->>'email','workspace'),'@',1)),
              auth.uid());
    end if;
    insert into workspace_members (workspace_id, user_id, role, status)
    select w.id, auth.uid(), 'admin', 'active'
      from workspaces w where w.owner_id = auth.uid()
    on conflict do nothing;
  end if;
  return query
    select m.workspace_id, w.name, m.role,
           (select count(*) from workspace_members x
             where x.workspace_id = m.workspace_id and x.status = 'active')
      from workspace_members m
      join workspaces w on w.id = m.workspace_id
     where m.user_id = auth.uid() and m.status = 'active';
end $$;

-- Diretório de membros (nome/e-mail vêm de auth.users, ilegível pelo client)
create or replace function workspace_directory(ws uuid)
returns table (member_id uuid, user_id uuid, email text, name text, role text, status text, invited_email text)
language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, u.email::text,
         coalesce(nullif(u.raw_user_meta_data->>'name',''), split_part(u.email,'@',1)),
         m.role, m.status, m.invited_email
    from workspace_members m
    left join auth.users u on u.id = m.user_id
   where m.workspace_id = ws
     and exists (select 1 from workspace_members me
                  where me.workspace_id = ws and me.user_id = auth.uid() and me.status = 'active')
$$;

revoke all on function accept_pending_invites() from public;
revoke all on function bootstrap_workspace() from public;
revoke all on function workspace_directory(uuid) from public;
grant execute on function accept_pending_invites() to authenticated;
grant execute on function bootstrap_workspace() to authenticated;
grant execute on function workspace_directory(uuid) to authenticated;

commit;
