// Cópia CommonJS de src/utils/recurrence.js — mesmo precedente de calcQuadrant
// já duplicado entre api/_lib.js e src/utils/statusConfig.js. Manter em sincronia
// manualmente se a lógica de recorrência mudar do lado do frontend.

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

function occursOn(block, dateStr) {
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

function expandOccurrences(blocks, fromStr, toStr) {
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

function nextDueDate(dueDate, recurrence) {
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

module.exports = { occursOn, expandOccurrences, nextDueDate }
