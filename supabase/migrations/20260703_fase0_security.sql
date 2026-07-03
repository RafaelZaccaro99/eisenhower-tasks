-- Fase 0 — segurança: remove a policy anônima de status_history.
-- A policy "anon access" (using true) permitia leitura/escrita do histórico
-- de status por qualquer requisição com a chave anon, sem JWT de usuário.
-- A policy "authenticated user history" (user_id = auth.uid()) permanece.

DROP POLICY IF EXISTS "anon access" ON status_history;
