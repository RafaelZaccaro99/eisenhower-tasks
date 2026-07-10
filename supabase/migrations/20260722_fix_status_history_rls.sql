-- ============================================================
-- Corrige vazamento entre workspaces em status_history: as policies
-- sh_select/sh_insert (20260710_workspaces.sql) só checavam que a
-- task_id existe em `tasks`, sem filtrar por workspace — qualquer
-- usuário autenticado, sabendo/enumerando um task_id de outro
-- workspace, conseguia ler ou inserir histórico ali. Alinha com o
-- mesmo padrão de tasks_select/tasks_insert.
-- ============================================================
begin;

drop policy if exists sh_select on status_history;
drop policy if exists sh_insert on status_history;

create policy sh_select on status_history for select to authenticated using (
  exists (
    select 1 from tasks t
    where t.id = status_history.task_id
      and t.workspace_id in (select my_workspaces())
  )
);

create policy sh_insert on status_history for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from tasks t
    where t.id = status_history.task_id
      and t.workspace_id in (select my_workspaces())
  )
);

commit;
