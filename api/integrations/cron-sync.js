const { sbService } = require('../_lib')

const SYNC_ENDPOINTS = {
  ical:    '/api/integrations/ical-sync',
  google:  '/api/integrations/google-sync',
  clickup: '/api/integrations/clickup-sync',
  jira:    '/api/integrations/jira-sync',
}

// Called by Vercel Cron every 15 minutes
module.exports = async (req, res) => {
  // Vercel injects CRON_SECRET as Authorization header for cron jobs
  const authHeader = req.headers.authorization || ''
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  try {
    const integrations = await sbService(
      '/calendar_integrations?enabled=eq.true&select=id,provider,user_id',
    )

    const appUrl = process.env.APP_URL || 'http://localhost:5173'
    const results = []

    for (const integration of integrations) {
      const endpoint = SYNC_ENDPOINTS[integration.provider]
      if (!endpoint) continue

      try {
        // For cron, we use a service-role request — the endpoint must accept it.
        // We send integration_id only; server-side uses sbService for reads.
        await fetch(`${appUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cron-Key': process.env.CRON_SECRET || '',
          },
          body: JSON.stringify({ integration_id: integration.id }),
        })
        results.push({ id: integration.id, provider: integration.provider, ok: true })
      } catch (e) {
        results.push({ id: integration.id, provider: integration.provider, error: e.message })
      }
    }

    res.json({ synced: results.length, results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
