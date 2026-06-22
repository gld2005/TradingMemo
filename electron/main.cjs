const { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen, shell } = require('electron');
const path = require('node:path');
const { createAttachmentStorage } = require('./attachment-storage.cjs');
const { registerNotesIpc } = require('./notes-ipc.cjs');
const { createNotesRepository } = require('./notes-repository.cjs');
const { createShortcutManager } = require('./shortcut-manager.cjs');
const { createStorageService } = require('./storage-service.cjs');
const { createSettingsService } = require('./settings-service.cjs');
const { createDataPortabilityService } = require('./data-portability-service.cjs');
const { createWindowManager } = require('./window-manager.cjs');
const { resolveFloatingPosition } = require('./floating-position.cjs');

const isDevelopment = process.argv.includes('--dev');

function loadRenderer(window, query = {}) {
  if (isDevelopment) {
    const search = new URLSearchParams(query).toString();
    return window.loadURL(`http://127.0.0.1:5173${search ? `?${search}` : ''}`);
  }

  return window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query });
}

const windowManager = createWindowManager({
  BrowserWindow,
  loadRenderer,
  onFloatingVisibilityChanged: () => broadcastFloatingState(),
  preloadPath: path.join(__dirname, 'preload.cjs'),
});
let shortcutRegistered = false;
let shortcutManager;

function floatingState() {
  return { ...windowManager.getFloatingState(), shortcutRegistered };
}

function broadcastFloatingState() {
  windowManager.getMainWindow()?.webContents.send('floating-state-changed', floatingState());
}

function registerIpcHandlers() {
  ipcMain.handle('window:set-title-bar-theme', (_event, theme) => windowManager.setMainWindowTheme(theme));
  ipcMain.handle('floating:get-state', () => floatingState());
  ipcMain.handle('floating:hide', () => {
    windowManager.hideFloatingWindow();
    broadcastFloatingState();
    return floatingState();
  });
  ipcMain.handle('floating:show', () => {
    windowManager.showFloatingWindow();
    broadcastFloatingState();
    return floatingState();
  });
  ipcMain.handle('floating:toggle', () => {
    windowManager.toggleFloatingWindow();
    broadcastFloatingState();
    return floatingState();
  });
  ipcMain.handle('floating:set-mode', (_event, mode) => {
    if (!windowManager.setFloatingMode(mode)) {
      throw new Error('Unable to change the floating window mode.');
    }
    return floatingState();
  });
  ipcMain.handle('floating:get-bounds', () => {
  const win = windowManager.getFloatingWindow();
  if (!win) return null;
  return win.getBounds(); // { x, y, width, height }
  });

ipcMain.on('floating:set-position', (_event, x, y, cursorX, cursorY, finalize) => {
  const win = windowManager.getFloatingWindow();
  if (!win || ![x, y, cursorX, cursorY].every(Number.isFinite)) return;
  const cursor = { x: Math.round(cursorX), y: Math.round(cursorY) };
  const display = screen.getDisplayNearestPoint(cursor);
  const [nextX, nextY] = resolveFloatingPosition({
    cursor,
    finalize: Boolean(finalize),
    target: { x, y },
    windowSize: win.getSize(),
    workArea: display.workArea,
  });
  win.setPosition(nextX, nextY);
});
}

function broadcastNotesChanged() {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('notes-changed');
  }
}

app.whenReady().then(async () => {
  const storage = createStorageService({
    dataDirectory: path.join(app.getPath('userData'), 'app-data'),
  });
  const attachmentStorage = createAttachmentStorage({
    attachmentsDirectory: path.join(storage.dataDirectory, 'attachments'),
  });
  const notesRepository = createNotesRepository({ storage, attachmentStorage });
  const settingsService = createSettingsService({ dataDirectory: storage.dataDirectory });
  const portability = createDataPortabilityService({ dataDirectory: storage.dataDirectory });

  registerIpcHandlers();
  registerNotesIpc({
    ipcMain,
    repository: notesRepository,
    attachmentStorage,
    dataFilePath: storage.dataFilePath,
    broadcastNotesChanged,
  });
  try {
    await notesRepository.initStorage();
    await settingsService.getSettings();
  } catch (error) {
    console.error('Local storage initialization failed:', error);
  }
  windowManager.createWindows();
  shortcutManager = createShortcutManager(globalShortcut, () => {
    windowManager.toggleFloatingWindow();
    broadcastFloatingState();
  });
  const initialSettings = await settingsService.getSettings();
  shortcutRegistered = shortcutManager.registerInitial(initialSettings.floatingShortcut);
  if (!shortcutRegistered) {
    console.warn(`${initialSettings.floatingShortcut} is unavailable. Use the main-window floating control instead.`);
  }

  const broadcastSettings = (settings) => BrowserWindow.getAllWindows().forEach((win) => win.webContents.send('settings-changed', settings));
  ipcMain.handle('settings:get', async () => settingsService.getSettings((await notesRepository.getCategories()).map(({id})=>id)));
  ipcMain.handle('settings:update', async (_event, patch) => {
    const current = await settingsService.getSettings();
    let shortcutChanged = false;
    if (patch.floatingShortcut && patch.floatingShortcut !== current.floatingShortcut) {
      const result = shortcutManager.replace(patch.floatingShortcut);
      shortcutRegistered = Boolean(shortcutManager.getCurrent());
      broadcastFloatingState();
      if (!result.ok) throw new Error('快捷键无效或已被占用，原快捷键仍然有效。');
      shortcutChanged = true;
    }
    let settings;
    try {
      settings = await settingsService.updateSettings(patch);
    } catch (error) {
      if (shortcutChanged) {
        shortcutManager.replace(current.floatingShortcut);
        shortcutRegistered = Boolean(shortcutManager.getCurrent());
        broadcastFloatingState();
      }
      throw error;
    }
    broadcastSettings(settings); broadcastFloatingState(); return settings;
  });
  ipcMain.handle('storage:open-directory', async () => { const error=await shell.openPath(storage.dataDirectory); if(error) throw new Error(error); });
  async function chooseDirectory(title) { const result=await dialog.showOpenDialog({title,properties:['openDirectory','createDirectory']}); return result.canceled ? null : result.filePaths[0]; }
  ipcMain.handle('data:export-markdown', async () => { const parent=await chooseDirectory('选择 Markdown 导出位置'); return parent ? portability.exportMarkdown(parent,await storage.readData()) : null; });
  ipcMain.handle('data:export-json', async () => { const parent=await chooseDirectory('选择 JSON 导出位置'); return parent ? portability.exportJson(parent,await storage.readData(),await settingsService.getSettings()) : null; });
  ipcMain.handle('data:backup', async () => { const parent=await chooseDirectory('选择备份位置'); return parent ? portability.backup(parent) : null; });
  ipcMain.handle('data:restore', async () => {
    const root=await chooseDirectory('选择备份目录');
    if(!root) return null;
    const result=await portability.restore(root);
    let settings=await settingsService.getSettings();
    const shortcutResult=shortcutManager.replace(settings.floatingShortcut);
    let warning=null;
    if(!shortcutResult.ok){
      if(!shortcutManager.getCurrent()) shortcutManager.replace('Alt+J');
      settings=await settingsService.updateSettings({floatingShortcut:shortcutManager.getCurrent()||'Alt+J'});
      warning='备份中的快捷键不可用，已保留当前可用快捷键。';
    }
    shortcutRegistered=Boolean(shortcutManager.getCurrent());
    broadcastSettings(settings); broadcastFloatingState(); broadcastNotesChanged();
    return {...result,warning};
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) windowManager.createWindows();
  });

  if (process.env.TRADING_MEMO_SMOKE_TEST === '1') {
    setTimeout(() => app.quit(), 1500);
  }
});

app.on('before-quit', () => {
  windowManager.prepareToQuit();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
