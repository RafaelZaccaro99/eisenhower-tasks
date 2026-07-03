// Regras de recorrência de blocos da agenda e tarefas.
// Datas sempre como strings 'YYYY-MM-DD' (comparação lexicográfica é segura).

function parseLocal(dateStr) {
  return new Date(dateStr + 'T00:00:00')
}

function fmt(d) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function lastDayOfMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate()
}

// Uma série recorrente ocorre em dateStr?
// - respeita recurrence_exceptions (datas puladas via "excluir só esta")
// - mensal: série do dia 29/30/31 cai no último dia de meses curtos
//   (comportamento estilo Google Calendar) em vez de sumir
export function occursOn(block, dateStr) {
  if (!block.recurrence || block.recurrence === 'none') return block.date === dateStr
  if (dateStr < block.date) return false
  if (block.recurrence_end && dateStr > block.recurrence_end) return false
  const exceptions = Array.isArray(block.recurrence_exceptions) ? block.recurrence_exceptions : []
  if (exceptions.includes(dateStr)) return false

  const origin = parseLocal(block.date)
  const target = parseLocal(dateStr)

  if (block.recurrence === 'daily') return true
  if (block.recurrence === 'weekly') return origin.getDay() === target.getDay()
  if (block.recurrence === 'monthly') {
    const wanted = Math.min(origin.getDate(), lastDayOfMonth(target.getFullYear(), target.getMonth()))
    return target.getDate() === wanted
  }
  return false
}

// Expande blocos (recorrentes ou não) em ocorrências no intervalo [fromStr, toStr].
// Cada ocorrência carrega date = data da ocorrência e seriesDate = data de origem da série.
export function expandOccurrences(blocks, fromStr, toStr) {
  const out = []
  const from = parseLocal(fromStr)
  const to = parseLocal(toStr)
  for (const block of blocks) {
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const ds = fmt(d)
      if (occursOn(block, ds)) {
        out.push({ ...block, date: ds, seriesDate: block.date })
      }
    }
  }
  return out
}

// Próxima data de vencimento de uma tarefa recorrente.
// Mensal: dia 31 vira o último dia do mês seguinte quando ele é mais curto.
export function nextDueDate(dueDate, recurrence) {
  const d = parseLocal(dueDate)
  if (recurrence === 'daily') d.setDate(d.getDate() + 1)
  else if (recurrence === 'weekly') d.setDate(d.getDate() + 7)
  else if (recurrence === 'monthly') {
    const day = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    d.setDate(Math.min(day, lastDayOfMonth(d.getFullYear(), d.getMonth())))
  }
  return fmt(d)
}
