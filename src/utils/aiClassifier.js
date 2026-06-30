import { callViaProxy } from './aiProxy'

export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic Claude',
    keyPlaceholder: 'sk-ant-...',
    keyHint: 'console.anthropic.com',
    models: [
      { id: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5 · rápido' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 · balanceado' },
      { id: 'claude-opus-4-8',   label: 'Claude Opus 4.8 · melhor' },
    ],
  },
  openai: {
    label: 'OpenAI',
    keyPlaceholder: 'sk-...',
    keyHint: 'platform.openai.com',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini · rápido' },
      { id: 'gpt-4o',      label: 'GPT-4o · melhor' },
    ],
  },
  groq: {
    label: 'Groq',
    keyPlaceholder: 'gsk_...',
    keyHint: 'console.groq.com',
    models: [
      { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B · ultra rápido' },
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B · melhor' },
      { id: 'gemma2-9b-it',            label: 'Gemma 2 9B · Google via Groq' },
    ],
  },
  google: {
    label: 'Google Gemini',
    keyPlaceholder: 'AIza...',
    keyHint: 'aistudio.google.com',
    models: [
      { id: 'gemini-2.0-flash',   label: 'Gemini 2.0 Flash · rápido' },
      { id: 'gemini-1.5-flash',   label: 'Gemini 1.5 Flash · balanceado' },
      { id: 'gemini-1.5-pro',     label: 'Gemini 1.5 Pro · melhor' },
    ],
  },
  xai: {
    label: 'xAI Grok',
    keyPlaceholder: 'xai-...',
    keyHint: 'console.x.ai',
    models: [
      { id: 'grok-3-mini',  label: 'Grok 3 Mini · rápido · grátis' },
      { id: 'grok-2-1212',  label: 'Grok 2 · melhor' },
    ],
  },
}

function buildPrompt(title, dueDate, anamnesis) {
  const urgencyTriggers   = (anamnesis.urgencyTriggers   ?? []).join(', ') || 'nenhum'
  const urgencyContexts   = (anamnesis.urgencyContexts   ?? []).join(', ') || 'nenhum'
  const importanceAreas   = (anamnesis.importanceAreas   ?? []).join(', ') || 'nenhum'
  const importanceTriggers= (anamnesis.importanceTriggers?? []).join(', ') || 'nenhum'
  const delegatableTriggers=(anamnesis.delegatableTriggers??[]).join(', ') || 'nenhum'
  const deadlineDays      = anamnesis.urgencyDeadlineDays ?? 2
  const dueDateText       = dueDate
    ? `Prazo: ${dueDate} (hoje é ${new Date().toISOString().split('T')[0]})`
    : 'Sem prazo definido'

  return `Classifique a tarefa na Matriz de Eisenhower com base no perfil do usuário.

PERFIL:
- Urgente quando prazo ≤ ${deadlineDays} dia(s)
- Palavras de urgência: ${urgencyTriggers}
- Contextos urgentes: ${urgencyContexts}
- Áreas de foco/importância: ${importanceAreas}
- Palavras de importância: ${importanceTriggers}
- Delegável: ${delegatableTriggers}
- Tem equipe para delegar: ${anamnesis.hasDelegation ? 'sim' : 'não'}

TAREFA: "${title}"
${dueDateText}

Responda SOMENTE com JSON válido neste formato:
{"urgent":boolean,"important":boolean,"quadrant":"q1"|"q2"|"q3"|"q4","confidence":0-100,"reasons":["razão 1","razão 2"]}`
}

function parseResult(text) {
  if (!text) return null
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  const r = JSON.parse(match[0])
  if (!r.quadrant) {
    r.quadrant = r.urgent && r.important ? 'q1'
      : !r.urgent && r.important ? 'q2'
      : r.urgent && !r.important ? 'q3' : 'q4'
  }
  return r
}

export async function classifyTaskWithAI(title, dueDate, anamnesis, { provider, model, apiKey }) {
  if (!apiKey || !title.trim()) return null
  const prompt = buildPrompt(title, dueDate, anamnesis)
  const text = await callViaProxy({
    provider,
    model,
    apiKey,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 256,
  })
  return parseResult(text)
}
