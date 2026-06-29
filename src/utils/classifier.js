/**
 * Semi-automatic task classifier based on anamnesis rules.
 * Returns { urgent, important, confidence, reasons }
 */
export function classifyTask(title, dueDate, anamnesis) {
  const text = (title || '').toLowerCase()
  const reasons = []
  let urgentScore = 0
  let importantScore = 0

  // ── Urgência: prazo ──────────────────────────────────────
  if (dueDate) {
    const days = Math.ceil((new Date(dueDate + 'T00:00:00') - new Date()) / 86400000)
    if (days <= 0) { urgentScore += 3; reasons.push('Prazo vencido ou hoje') }
    else if (days <= (anamnesis.urgencyDeadlineDays ?? 2)) {
      urgentScore += 2
      reasons.push(`Prazo em ${days} dia${days !== 1 ? 's' : ''}`)
    }
  }

  // ── Urgência: palavras-chave ──────────────────────────────
  for (const kw of anamnesis.urgencyTriggers ?? []) {
    if (text.includes(kw.toLowerCase())) {
      urgentScore += 1
      reasons.push(`Palavra-chave urgente: "${kw}"`)
    }
  }
  for (const ctx of anamnesis.urgencyContexts ?? []) {
    if (text.includes(ctx.toLowerCase())) {
      urgentScore += 2
      reasons.push(`Contexto urgente: "${ctx}"`)
    }
  }

  // ── Importância: áreas de foco ────────────────────────────
  for (const area of anamnesis.importanceAreas ?? []) {
    if (text.includes(area.toLowerCase())) {
      importantScore += 2
      reasons.push(`Área de foco: "${area}"`)
    }
  }

  // ── Importância: palavras-chave ───────────────────────────
  for (const kw of anamnesis.importanceTriggers ?? []) {
    if (text.includes(kw.toLowerCase())) {
      importantScore += 1
      reasons.push(`Palavra-chave importante: "${kw}"`)
    }
  }
  for (const ctx of anamnesis.importanceContexts ?? []) {
    if (text.includes(ctx.toLowerCase())) {
      importantScore += 2
      reasons.push(`Contexto importante: "${ctx}"`)
    }
  }

  const urgent = urgentScore >= 1
  const important = importantScore >= 1

  // Confiança: 0–100
  const maxScore = 5
  const confidence = Math.min(
    100,
    Math.round(((urgentScore + importantScore) / (maxScore * 2)) * 100)
  )

  let quadrant = 'q4'
  if (urgent && important) quadrant = 'q1'
  else if (!urgent && important) quadrant = 'q2'
  else if (urgent && !important) quadrant = 'q3'

  return { urgent, important, quadrant, confidence, reasons }
}

export function quadrantLabel(q) {
  return { q1: 'Fazer agora', q2: 'Agendar', q3: 'Delegar', q4: 'Eliminar' }[q] ?? q
}
