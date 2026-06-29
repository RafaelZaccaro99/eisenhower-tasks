import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  tasks: {
    getAll: () => ipcRenderer.invoke('tasks:getAll'),
    create: (task) => ipcRenderer.invoke('tasks:create', task),
    update: (task) => ipcRenderer.invoke('tasks:update', task),
    delete: (id) => ipcRenderer.invoke('tasks:delete', id),
  },
  agenda: {
    getByDate: (date) => ipcRenderer.invoke('agenda:getByDate', date),
    getRange: (range) => ipcRenderer.invoke('agenda:getRange', range),
    create: (block) => ipcRenderer.invoke('agenda:create', block),
    update: (block) => ipcRenderer.invoke('agenda:update', block),
    delete: (id) => ipcRenderer.invoke('agenda:delete', id),
  },
  people: {
    getAll: () => ipcRenderer.invoke('people:getAll'),
    create: (person) => ipcRenderer.invoke('people:create', person),
    update: (person) => ipcRenderer.invoke('people:update', person),
    delete: (id) => ipcRenderer.invoke('people:delete', id),
  },
  notify: (opts) => ipcRenderer.invoke('notify', opts),
})
