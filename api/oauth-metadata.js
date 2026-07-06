// Descoberta OAuth para o servidor MCP remoto (RFC 8414 + RFC 9728).
// Exposto na raiz do domínio via rewrites em vercel.json:
//   /.well-known/oauth-authorization-server -> este arquivo
//   /.well-known/oauth-protected-resource   -> este arquivo?type=protected-resource
const SCOPES = 'tasks:read tasks:write agenda:read agenda:write people:read clients:read'

module.exports = async (req, res) => {
  const base = process.env.APP_URL || 'https://eisenhower-tasks.vercel.app'
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.query.type === 'protected-resource') {
    return res.status(200).json({
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      bearer_methods_supported: ['header'],
      scopes_supported: SCOPES.split(' '),
    })
  }

  return res.status(200).json({
    issuer: base,
    authorization_endpoint: `${base}/api/mcp-auth/authorize`,
    token_endpoint: `${base}/api/mcp-auth/token`,
    registration_endpoint: `${base}/api/mcp-auth/register`,
    scopes_supported: SCOPES.split(' '),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  })
}
