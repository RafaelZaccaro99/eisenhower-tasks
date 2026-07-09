// E-mails transacionais via Resend. Hoje só convite de workspace; sem
// RESEND_API_KEY configurada, no-opa silenciosamente — o convite já
// funciona sem e-mail (a pessoa entra no workspace no primeiro login com
// o e-mail convidado), o e-mail é só uma conveniência.
const { cors, requireAuth, sb } = require('./_lib')

const APP_URL = process.env.APP_URL || 'http://localhost:5173'
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM = process.env.RESEND_FROM || 'Eisenhower Tasks <onboarding@resend.dev>'

const ROLE_LABELS = { admin: 'Admin', manager: 'Gestor', member: 'Membro' }

async function sendViaResend({ to, subject, html }) {
  if (!RESEND_API_KEY) return { sent: false, reason: 'email_not_configured' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || `Resend HTTP ${res.status}`)
  }
  return { sent: true }
}

function inviteEmailHtml({ workspaceName, role, appUrl }) {
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#12151d">
    <p style="font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#5b3fa0;font-weight:600;margin:0 0 16px">Eisenhower Tasks</p>
    <h1 style="font-size:20px;margin:0 0 16px">Você foi convidado para o workspace "${workspaceName}"</h1>
    <p style="font-size:14.5px;line-height:1.6;color:#4b5262">Você foi convidado como <strong>${ROLE_LABELS[role] || role}</strong>. Para entrar, crie uma conta (ou faça login, se já tiver uma) usando este mesmo e-mail — você será adicionado ao workspace automaticamente.</p>
    <a href="${appUrl}" style="display:inline-block;margin-top:20px;background:#5b3fa0;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14.5px;font-weight:600">Entrar no Eisenhower Tasks</a>
  </div>`
}

async function workspaceInvite(req, res, token) {
  const { workspace_id, invited_email } = req.body || {}
  if (!workspace_id || !invited_email) return res.status(400).json({ error: 'missing_fields' })

  // RLS garante que só um membro ativo do workspace enxerga essa linha —
  // reaproveita a checagem de autorização em vez de reimplementá-la.
  const [member] = await sb(
    `/workspace_members?workspace_id=eq.${workspace_id}&invited_email=eq.${encodeURIComponent(invited_email)}&status=eq.invited`,
    'GET', undefined, token,
  )
  if (!member) return res.status(404).json({ error: 'invite_not_found' })

  const [workspace] = await sb(`/workspaces?id=eq.${workspace_id}`, 'GET', undefined, token)
  if (!workspace) return res.status(404).json({ error: 'workspace_not_found' })

  const result = await sendViaResend({
    to: invited_email,
    subject: `Convite para o workspace "${workspace.name}" — Eisenhower Tasks`,
    html: inviteEmailHtml({ workspaceName: workspace.name, role: member.role, appUrl: APP_URL }),
  })
  return res.status(200).json(result)
}

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const token = requireAuth(req, res)
  if (!token) return

  try {
    const { kind } = req.body || {}
    if (kind === 'workspace_invite') return await workspaceInvite(req, res, token)
    return res.status(400).json({ error: 'unknown_kind' })
  } catch (e) {
    return res.status(500).json({ error: 'server_error', error_description: e.message })
  }
}
