const { cors, requireAuth } = require('./_lib')

async function callProvider({ provider, model, apiKey, messages, systemPrompt, maxTokens = 1024 }) {
  switch (provider) {
    case 'anthropic': {
      const body = { model, max_tokens: maxTokens, messages }
      if (systemPrompt) body.system = systemPrompt
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      return data.content?.[0]?.text
    }
    case 'openai':
    case 'groq':
    case 'xai': {
      const base = provider === 'groq' ? 'https://api.groq.com/openai'
        : provider === 'xai' ? 'https://api.x.ai'
        : 'https://api.openai.com'
      const msgs = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: msgs }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      return data.choices?.[0]?.message?.content
    }
    case 'google': {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const body = {
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: maxTokens },
      }
      if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      return data.candidates?.[0]?.content?.parts?.[0]?.text
    }
    default:
      throw new Error(`Provedor desconhecido: ${provider}`)
  }
}

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const token = requireAuth(req, res)
  if (!token) return

  const { provider, model, apiKey, messages, systemPrompt, maxTokens } = req.body || {}

  if (!provider || !model || !apiKey || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'missing_required_fields' })
  }

  try {
    const text = await callProvider({ provider, model, apiKey, messages, systemPrompt, maxTokens })
    res.status(200).json({ text })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
