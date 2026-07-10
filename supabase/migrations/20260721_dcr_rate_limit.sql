-- ============================================================
-- Rate limit no endpoint público de DCR (POST /api/mcp-auth/register)
-- Igual às tabelas de OAuth: só sbService() (service role) toca aqui,
-- RLS habilitado sem policies = default-deny total.
-- ============================================================
begin;

create table if not exists dcr_rate_limits (
  ip_hash      text not null,
  window_start timestamptz not null,
  count        integer not null default 1,
  primary key (ip_hash, window_start)
);
create index if not exists dcr_rate_limits_window_idx on dcr_rate_limits(window_start);

alter table dcr_rate_limits enable row level security;
-- (nenhuma policy criada — authenticated/anon não têm nenhum acesso)

commit;
