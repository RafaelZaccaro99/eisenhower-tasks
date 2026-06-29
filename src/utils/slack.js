const BASE = '/slack-api'

async function slackCall(method, token, body) {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error ?? 'slack_error')
  return data
}

async function openDM(token, userId) {
  const data = await slackCall('conversations.open', token, { users: userId })
  return data.channel.id
}

export async function sendSlackMessage(token, userId, text, blocks) {
  const channelId = await openDM(token, userId)
  return slackCall('chat.postMessage', token, {
    channel: channelId,
    text,
    ...(blocks ? { blocks } : {}),
  })
}

export function buildBlocks(message, task) {
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: message },
    },
  ]

  if (task) {
    const quadrantLabel = { q1: '🔴 Fazer agora', q2: '🔵 Agendar', q3: '🟡 Delegar', q4: '⚪ Eliminar' }
    const lines = [
      `*📌 Tarefa relacionada:* ${task.title}`,
      `*Quadrante:* ${quadrantLabel[task.quadrant] ?? task.quadrant}`,
      task.due_date ? `*Prazo:* ${task.due_date}` : null,
      task.category ? `*Categoria:* ${task.category}` : null,
    ].filter(Boolean)

    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: lines.join('\n') },
    })
  }

  return blocks
}

// Derive quadrant from urgent/important flags
export function taskQuadrant(task) {
  if (task.urgent && task.important) return 'q1'
  if (!task.urgent && task.important) return 'q2'
  if (task.urgent && !task.important) return 'q3'
  return 'q4'
}
