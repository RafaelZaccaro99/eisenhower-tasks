import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR)

function readJSON(name, fallback = []) {
  const file = join(DATA_DIR, `${name}.json`)
  try { return JSON.parse(readFileSync(file, 'utf-8')) }
  catch { return fallback }
}
function writeJSON(name, data) {
  writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2))
}

function calcQuadrant(urgent, important) {
  if (urgent && important) return 'q1'
  if (!urgent && important) return 'q2'
  if (urgent && !important) return 'q3'
  return 'q4'
}

const app = express()
app.use(cors())
app.use(express.json())

// ── Tasks ────────────────────────────────────────────────────────────────────

app.get('/api/tasks', (_, res) => res.json(readJSON('tasks')))

app.post('/api/tasks', (req, res) => {
  const tasks = readJSON('tasks')
  const task = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    status: 'pending',
    category: 'geral',
    ...req.body,
    urgent:    !!req.body.urgent,
    important: !!req.body.important,
    quadrant:  calcQuadrant(!!req.body.urgent, !!req.body.important),
  }
  tasks.push(task)
  writeJSON('tasks', tasks)
  res.json(task)
})

app.put('/api/tasks/:id', (req, res) => {
  const tasks = readJSON('tasks')
  const idx = tasks.findIndex(t => t.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not_found' })
  const updated = {
    ...tasks[idx],
    ...req.body,
    urgent:    req.body.urgent    !== undefined ? !!req.body.urgent    : tasks[idx].urgent,
    important: req.body.important !== undefined ? !!req.body.important : tasks[idx].important,
  }
  updated.quadrant = calcQuadrant(updated.urgent, updated.important)
  tasks[idx] = updated
  writeJSON('tasks', tasks)
  res.json(updated)
})

app.delete('/api/tasks/:id', (req, res) => {
  writeJSON('tasks', readJSON('tasks').filter(t => t.id !== req.params.id))
  res.json({ ok: true })
})

// ── People ────────────────────────────────────────────────────────────────────

app.get('/api/people', (_, res) => res.json(readJSON('people')))

app.post('/api/people', (req, res) => {
  const people = readJSON('people')
  const person = { id: randomUUID(), created_at: new Date().toISOString(), ...req.body }
  people.push(person)
  writeJSON('people', people)
  res.json(person)
})

app.put('/api/people/:id', (req, res) => {
  const people = readJSON('people')
  const idx = people.findIndex(p => p.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not_found' })
  people[idx] = { ...people[idx], ...req.body }
  writeJSON('people', people)
  res.json(people[idx])
})

app.delete('/api/people/:id', (req, res) => {
  writeJSON('people', readJSON('people').filter(p => p.id !== req.params.id))
  res.json({ ok: true })
})

// ── Blocks (Agenda) ───────────────────────────────────────────────────────────

app.get('/api/blocks', (_, res) => res.json(readJSON('blocks')))

app.post('/api/blocks', (req, res) => {
  const blocks = readJSON('blocks')
  const block = { id: randomUUID(), ...req.body }
  blocks.push(block)
  writeJSON('blocks', blocks)
  res.json(block)
})

app.put('/api/blocks/:id', (req, res) => {
  const blocks = readJSON('blocks')
  const idx = blocks.findIndex(b => b.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not_found' })
  blocks[idx] = { ...blocks[idx], ...req.body }
  writeJSON('blocks', blocks)
  res.json(blocks[idx])
})

app.delete('/api/blocks/:id', (req, res) => {
  writeJSON('blocks', readJSON('blocks').filter(b => b.id !== req.params.id))
  res.json({ ok: true })
})

// ── Context (for AI) ─────────────────────────────────────────────────────────

app.get('/api/context', (_, res) => {
  const tasks  = readJSON('tasks')
  const people = readJSON('people')
  const pending   = tasks.filter(t => t.status !== 'completed')
  const completed = tasks.filter(t => t.status === 'completed')
  res.json({
    summary: {
      total: tasks.length,
      pending: pending.length,
      completed: completed.length,
      by_quadrant: {
        q1: pending.filter(t => t.quadrant === 'q1').length,
        q2: pending.filter(t => t.quadrant === 'q2').length,
        q3: pending.filter(t => t.quadrant === 'q3').length,
        q4: pending.filter(t => t.quadrant === 'q4').length,
      },
    },
    pending,
    completed,
    people,
  })
})

// ── Sync (React app pushes localStorage on first boot) ───────────────────────

app.post('/api/sync', (req, res) => {
  const { tasks, people } = req.body
  const existingTasks  = readJSON('tasks')
  const existingPeople = readJSON('people')
  // Only overwrite if server is empty (first sync)
  if (tasks  && existingTasks.length  === 0) writeJSON('tasks',  tasks)
  if (people && existingPeople.length === 0) writeJSON('people', people)
  res.json({ ok: true, tasks: readJSON('tasks').length, people: readJSON('people').length })
})

app.get('/api/health', (_, res) => res.json({ ok: true, ts: Date.now() }))

const PORT = 3001
app.listen(PORT, () => {
  console.log(`\n🗂  Eisenhower data server  →  http://localhost:${PORT}`)
  console.log(`   MCP: node mcp-server.mjs\n`)
})
