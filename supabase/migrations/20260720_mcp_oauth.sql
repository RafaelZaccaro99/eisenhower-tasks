-- ============================================================
-- MCP REMOTO — Authorization Server (RFC 7591 DCR + RFC 6749/7636 PKCE)
--
-- Estas tabelas são tocadas EXCLUSIVAMENTE por sbService() (service role).
-- RLS habilitado sem policies = default-deny total para anon/authenticated;
-- nenhuma delas deve ser acessada pelo client via chave anon.
--
-- Rodar ANTES do deploy de api/oauth-metadata.js, api/mcp-auth/[[...action]].js
-- e api/mcp.js.
-- ============================================================
begin;

-- 1) Clientes registrados dinamicamente (DCR) — público, sem client_secret,
--    PKCE S256 obrigatório em todo authorization_code emitido para eles.
create table if not exists mcp_clients (
  client_id                  text primary key,
  client_name                text not null default 'MCP Client',
  redirect_uris              text[] not null,
  token_endpoint_auth_method text not null default 'none' check (token_endpoint_auth_method = 'none'),
  grant_types                text[] not null default array['authorization_code','refresh_token'],
  response_types             text[] not null default array['code'],
  scope                      text not null default 'tasks:read tasks:write agenda:read agenda:write people:read clients:read',
  created_at                 timestamptz not null default now()
);

-- 2) Authorization requests pendentes — criadas no GET /authorize, antes do
--    usuário logar/escolher workspace/consentir. Curta duração (10 min).
create table if not exists mcp_authorization_requests (
  id                    uuid primary key default gen_random_uuid(),
  client_id             text not null references mcp_clients(client_id) on delete cascade,
  redirect_uri          text not null,
  state                 text,
  code_challenge        text not null,
  code_challenge_method text not null default 'S256' check (code_challenge_method = 'S256'),
  scope                 text,
  resource              text, -- RFC 8707 resource indicator (opcional, forward-compat)
  consumed              boolean not null default false,
  created_at            timestamptz not null default now(),
  expires_at            timestamptz not null default (now() + interval '10 minutes')
);
create index if not exists mcp_authz_req_expiry_idx on mcp_authorization_requests(expires_at);

-- 3) Authorization codes — single-use, ~5 min, ligados a code_challenge,
--    redirect_uri, user_id e workspace_id já resolvidos no consentimento.
create table if not exists mcp_authorization_codes (
  code                  text primary key,
  client_id             text not null references mcp_clients(client_id) on delete cascade,
  redirect_uri          text not null,
  code_challenge        text not null,
  code_challenge_method text not null,
  user_id               uuid not null references auth.users(id) on delete cascade,
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  scope                 text,
  used                  boolean not null default false,
  created_at            timestamptz not null default now(),
  expires_at            timestamptz not null default (now() + interval '5 minutes')
);
create index if not exists mcp_codes_expiry_idx on mcp_authorization_codes(expires_at);

-- 4) Tokens emitidos — SÓ o hash SHA-256 é armazenado, nunca o valor puro
--    (diferente de calendar_integrations, que usa encrypt()/decrypt() porque
--    o valor cru precisa ser reenviado ao provedor externo; aqui o valor só
--    existe no instante da emissão e nunca mais precisa ser lido de volta).
create table if not exists mcp_tokens (
  id                        uuid primary key default gen_random_uuid(),
  client_id                 text not null references mcp_clients(client_id) on delete cascade,
  user_id                   uuid not null references auth.users(id) on delete cascade,
  workspace_id              uuid not null references workspaces(id) on delete cascade,
  scope                     text,
  access_token_hash         text not null unique,
  access_token_expires_at   timestamptz not null,
  refresh_token_hash        text unique,
  refresh_token_expires_at  timestamptz,
  revoked                   boolean not null default false,
  created_at                timestamptz not null default now(),
  last_used_at              timestamptz
);
create index if not exists mcp_tokens_access_idx  on mcp_tokens(access_token_hash) where revoked = false;
create index if not exists mcp_tokens_refresh_idx on mcp_tokens(refresh_token_hash) where revoked = false;
create index if not exists mcp_tokens_user_ws_idx on mcp_tokens(user_id, workspace_id);

-- 5) RLS — default deny total. Só service_role (sbService) toca estas tabelas.
alter table mcp_clients                enable row level security;
alter table mcp_authorization_requests enable row level security;
alter table mcp_authorization_codes    enable row level security;
alter table mcp_tokens                 enable row level security;
-- (nenhuma policy criada — authenticated/anon não têm nenhum acesso)

commit;
