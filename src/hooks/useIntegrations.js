import { useState, useEffect, useCallback } from 'react'
import { dataApi, isServerUp } from '../utils/dataApi'

const SYNC_ENDPOINTS = {
  ical:    '/api/integrations/ical-sync',
  google:  '/api/integrations/google-sync',
  clickup: '/api/integrations/clickup-sync',
  jira:    '/api/integrations/jira-sync',
}

export function useIntegrations(accessToken) {
  const [integrations, setIntegrations] = useState([])
  const [externalEvents, setExternalEvents] = useState([])
  const [loading, setLoading] = useState(false)

  async function loadAll() {
    if (!accessToken) return
    try {
      const up = await isServerUp()
      if (!up) return
      const list = await dataApi.integrations.list()
      setIntegrations(list)
      if (list.length > 0) {
        const evs = await dataApi.external_events.listByIntegrations(list.map(i => i.id))
        setExternalEvents(evs)
      } else {
        setExternalEvents([])
      }
    } catch { /* non-critical */ }
  }

  useEffect(() => { loadAll() }, [accessToken])

  const createIntegration = useCallback(async (data) => {
    const created = await dataApi.integrations.create(data)
    await loadAll()
    return created
  }, [accessToken])

  const updateIntegration = useCallback(async (id, data) => {
    await dataApi.integrations.update(id, data)
    await loadAll()
  }, [accessToken])

  const deleteIntegration = useCallback(async (id) => {
    await dataApi.external_events.deleteByIntegration(id)
    await dataApi.integrations.delete(id)
    setIntegrations(prev => prev.filter(i => i.id !== id))
    setExternalEvents(prev => prev.filter(e => e.integration_id !== id))
  }, [])

  const syncIntegration = useCallback(async (integration) => {
    if (!accessToken) return
    const endpoint = SYNC_ENDPOINTS[integration.provider]
    if (!endpoint) return

    setLoading(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ integration_id: integration.id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      await loadAll()
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  // Start OAuth flow — server returns the redirect URL
  const connectOAuth = useCallback(async (provider) => {
    if (!accessToken) return
    const res = await fetch(`/api/oauth/${provider}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else throw new Error(data.error || 'oauth_error')
  }, [accessToken])

  // Create Google Calendar event from a block/task
  const createGoogleEvent = useCallback(async (payload) => {
    if (!accessToken) return null
    const google = integrations.find(i => i.provider === 'google' && i.enabled)
    if (!google) return null
    const res = await fetch('/api/integrations/google-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ integration_id: google.id, ...payload }),
    })
    return res.json()
  }, [accessToken, integrations])

  // Create ClickUp task from an Eisenhower task
  const createClickupTask = useCallback(async (integration, payload) => {
    if (!accessToken) return null
    const res = await fetch('/api/integrations/clickup-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ integration_id: integration.id, ...payload }),
    })
    return res.json()
  }, [accessToken])

  // Create Jira issue from an Eisenhower task
  const createJiraIssue = useCallback(async (integration, payload) => {
    if (!accessToken) return null
    const res = await fetch('/api/integrations/jira-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ integration_id: integration.id, ...payload }),
    })
    return res.json()
  }, [accessToken])

  return {
    integrations,
    externalEvents,
    loading,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    syncIntegration,
    connectOAuth,
    createGoogleEvent,
    createClickupTask,
    createJiraIssue,
    reload: loadAll,
  }
}
