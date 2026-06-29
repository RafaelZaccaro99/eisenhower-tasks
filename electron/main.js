import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV === 'development'

let dbPath
let win

// ── Simple JSON store ─────────────────────────────────────
function readDb() {
  try { return JSON.parse(fs.readFileSync(dbPath, 'utf-8')) }
  catch { return { tasks: [], blocks: [], people: [] } }
}
function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8')
}

// ── Window ────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Eisenhower Tasks',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  dbPath = path.join(app.getPath('userData'), 'eisenhower-tasks.json')
  if (!fs.existsSync(dbPath)) writeDb({ tasks: [], blocks: [] })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Tasks ─────────────────────────────────────────────────
ipcMain.handle('tasks:getAll', () => {
  return readDb().tasks
})

ipcMain.handle('tasks:create', (_, task) => {
  const db = readDb()
  db.tasks.push(task)
  writeDb(db)
  return task
})

ipcMain.handle('tasks:update', (_, task) => {
  const db = readDb()
  const idx = db.tasks.findIndex(t => t.id === task.id)
  if (idx !== -1) db.tasks[idx] = { ...db.tasks[idx], ...task }
  writeDb(db)
  return db.tasks[idx]
})

ipcMain.handle('tasks:delete', (_, id) => {
  const db = readDb()
  db.tasks = db.tasks.filter(t => t.id !== id)
  db.blocks = db.blocks.filter(b => b.task_id !== id)
  writeDb(db)
  return { success: true }
})

// ── Agenda Blocks ─────────────────────────────────────────
ipcMain.handle('agenda:getByDate', (_, date) => {
  const db = readDb()
  return db.blocks.filter(b => b.date === date).sort((a, b) => a.start_time.localeCompare(b.start_time))
})

ipcMain.handle('agenda:getRange', (_, { start, end }) => {
  const db = readDb()
  return db.blocks.filter(b => b.date >= start && b.date <= end)
})

ipcMain.handle('agenda:create', (_, block) => {
  const db = readDb()
  db.blocks.push(block)
  writeDb(db)
  return block
})

ipcMain.handle('agenda:update', (_, block) => {
  const db = readDb()
  const idx = db.blocks.findIndex(b => b.id === block.id)
  if (idx !== -1) db.blocks[idx] = { ...db.blocks[idx], ...block }
  writeDb(db)
  return db.blocks[idx]
})

ipcMain.handle('agenda:delete', (_, id) => {
  const db = readDb()
  db.blocks = db.blocks.filter(b => b.id !== id)
  writeDb(db)
  return { success: true }
})

// ── People ────────────────────────────────────────────────
ipcMain.handle('people:getAll', () => {
  return (readDb().people ?? [])
})

ipcMain.handle('people:create', (_, person) => {
  const db = readDb()
  if (!db.people) db.people = []
  db.people.push(person)
  writeDb(db)
  return person
})

ipcMain.handle('people:update', (_, person) => {
  const db = readDb()
  if (!db.people) db.people = []
  const idx = db.people.findIndex(p => p.id === person.id)
  if (idx !== -1) db.people[idx] = { ...db.people[idx], ...person }
  writeDb(db)
  return db.people[idx]
})

ipcMain.handle('people:delete', (_, id) => {
  const db = readDb()
  db.people = (db.people ?? []).filter(p => p.id !== id)
  writeDb(db)
  return { success: true }
})

// ── Notifications ──────────────────────────────────────────
ipcMain.handle('notify', (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
})
