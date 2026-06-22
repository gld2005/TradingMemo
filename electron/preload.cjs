const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  createNote: (input) => ipcRenderer.invoke('notes:create', input),
  updateNote: (id, input) => ipcRenderer.invoke('notes:update', id, input),
  deleteNote: (id) => ipcRenderer.invoke('notes:delete', id),
  getAttachments: (ids) => ipcRenderer.invoke('attachments:get', ids),
  readAttachment: (id) => ipcRenderer.invoke('attachments:read', id),
  getAllNotes: () => ipcRenderer.invoke('notes:get-all'),
  getCategories: () => ipcRenderer.invoke('categories:get'),
  createCategory: (input) => ipcRenderer.invoke('categories:create', input),
  updateCategory: (id, input) => ipcRenderer.invoke('categories:update', id, input),
  deleteCategory: (id) => ipcRenderer.invoke('categories:delete', id),
  getTags: () => ipcRenderer.invoke('tags:get'),
  createTag: (input) => ipcRenderer.invoke('tags:create', input),
  updateTag: (id, input) => ipcRenderer.invoke('tags:update', id, input),
  deleteTag: (id) => ipcRenderer.invoke('tags:delete', id),
  getFloatingState: () => ipcRenderer.invoke('floating:get-state'),
  getStorageInfo: () => ipcRenderer.invoke('storage:get-info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  openDataDirectory: () => ipcRenderer.invoke('storage:open-directory'),
  exportMarkdown: () => ipcRenderer.invoke('data:export-markdown'),
  exportJson: () => ipcRenderer.invoke('data:export-json'),
  backupData: () => ipcRenderer.invoke('data:backup'),
  restoreData: () => ipcRenderer.invoke('data:restore'),
  hideFloatingWindow: () => ipcRenderer.invoke('floating:hide'),
  onFloatingShown: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('floating-shown', listener);
    return () => ipcRenderer.removeListener('floating-shown', listener);
  },
  onFloatingStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('floating-state-changed', listener);
    return () => ipcRenderer.removeListener('floating-state-changed', listener);
  },
  onNotesChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('notes-changed', listener);
    return () => ipcRenderer.removeListener('notes-changed', listener);
  },
  onSettingsChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('settings-changed', listener);
    return () => ipcRenderer.removeListener('settings-changed', listener);
  },
  setFloatingMode: (mode) => ipcRenderer.invoke('floating:set-mode', mode),
  showFloatingWindow: () => ipcRenderer.invoke('floating:show'),
  toggleFloatingWindow: () => ipcRenderer.invoke('floating:toggle'),
});
