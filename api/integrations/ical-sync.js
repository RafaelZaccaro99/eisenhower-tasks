const { cors, requireAuth, sb } = require('../_lib')

// Minimal iCal parser — handles VEVENT blocks with folded lines
function parseICS(text) {
  const unfolded = text
    .replace(/\r\n[ \t]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  const events = []
  const re = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g
  let m
  while ((m = re.exec(unfolded)) !== null) {
    const block = m[1]
    const ev = {}
    const lineRe = /^([A-Z-]+)(?:;[^:]+)?:(.*)$/gm
    let lm
    while ((lm = lineRe.exec(block)) !== null) {
      ev[lm[1]] = lm[2].trim()
    }
    events.push(ev)
  }
  return events
}

function parseICSDate(val) {
  if (!val) return null
  const v = val.replace(/[TZ]/g, '')
  const allDay = v.length === 8
  const date = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`
  if (allDay) return { date, time: null, allDay: true }
  const time = `${v.slice(8, 10)}:${v.slice(10, 12)}`
  return { date, time, allDay: false }
}

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const token = requireAuth(req, res)
  if (!token) return

  const { integration_id } = req.body || {}
  if (!integration_id) return res.status(400).json({ error: 'missing integration_id' })

  try {
    const list = await sb(
      `/calendar_integrations?id=eq.${integration_id}&provider=eq.ical`,
      'GET', undefined, token,
    )
    const integration = list[0]
    if (!integration) return res.status(404).json({ error: 'integration_not_found' })

    const icalUrl = integration.config?.ical_url
    if (!icalUrl) return res.status(400).json({ error: 'missing ical_url in config' })

    const icsRes = await fetch(icalUrl, { signal: AbortSignal.timeout(15_000) })
    if (!icsRes.ok) throw new Error(`fetch_failed: ${icsRes.status}`)
    const icsText = await icsRes.text()

    const rawEvents = parseICS(icsText)
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const cutoff = new Date(now.getTime() + 90 * 24 * 3600 * 1000)

    const rows = rawEvents
      .map(ev => {
        const start = parseICSDate(ev['DTSTART'])
        const end = parseICSDate(ev['DTEND'])
        if (!start) return null
        if (start.date < todayStr) return null
        if (new Date(start.date) > cutoff) return null
        return {
          integration_id,
          external_id: ev['UID'] || `${integration_id}-${ev['DTSTART']}`,
          title: ev['SUMMARY'] || '(sem título)',
          date: start.date,
          start_time: start.time,
          end_time: end?.time || null,
          all_day: start.allDay,
          url: ev['URL'] || '',
          provider: 'ical',
        }
      })
      .filter(Boolean)

    if (rows.length > 0) {
      await sb('/external_events', 'POST', rows, token, true)
    }

    // Remove stale events before today
    await sb(
      `/external_events?integration_id=eq.${integration_id}&date=lt.${todayStr}`,
      'DELETE', undefined, token,
    )

    await sb(
      `/calendar_integrations?id=eq.${integration_id}`,
      'PATCH', { last_sync: new Date().toISOString() }, token,
    )

    res.json({ synced: rows.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
