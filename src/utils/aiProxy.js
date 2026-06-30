let _token = ''

export function setProxyToken(t) { _token = t }

export async function callViaProxy({ provider, model, apiKey, messages, systemPrompt, maxTokens = 1024 }) {
  const res = await fetch('/api/classify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${_token}`,
    },
    body: JSON.stringify({ provider, model, apiKey, messages, systemPrompt, maxTokens }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data.text
}
