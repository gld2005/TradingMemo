const FLOATING_SIZES = {
  expanded: [380, 640],
  mini: [104, 52],
};

function createWindowManager({
  BrowserWindow,
  loadRenderer,
  onFloatingVisibilityChanged = () => undefined,
  preloadPath,
}) {
  let mainWindow = null;
  let floatingWindow = null;
  let floatingMode = 'expanded';
  let quitting = false;

  function createWindows() {
    const sharedPreferences = {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    };

    mainWindow = new BrowserWindow({
      width: 1180,
      height: 760,
      minWidth: 880,
      minHeight: 600,
      backgroundColor: '#f5f7fb',
      title: 'Windows 桌面浮窗版 A 股学习笔记软件',
      webPreferences: sharedPreferences,
    });

    floatingWindow = new BrowserWindow({
      width: FLOATING_SIZES.expanded[0],
      height: FLOATING_SIZES.expanded[1],
      show: false,
      alwaysOnTop: true,
      backgroundColor: '#00000000',
      frame: false,
      fullscreenable: false,
      hasShadow: true,
      maximizable: false,
      minimizable: false,
      resizable: false,
      skipTaskbar: true,
      title: '今日笔记',
      transparent: true,
      webPreferences: sharedPreferences,
    });

    floatingWindow.on('close', (event) => {
      if (quitting) return;
      event.preventDefault();
      floatingWindow?.hide();
      onFloatingVisibilityChanged(false);
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
    floatingWindow.on('closed', () => {
      floatingWindow = null;
    });

    void loadRenderer(mainWindow);
    void loadRenderer(floatingWindow, { window: 'floating' });

    return { mainWindow, floatingWindow };
  }

  function showFloatingWindow() {
    if (!floatingWindow) return false;
    floatingWindow.show();
    floatingWindow.focus();
    floatingWindow.webContents?.send?.('floating-shown');
    return true;
  }

  function hideFloatingWindow() {
    floatingWindow?.hide();
    return false;
  }

  function toggleFloatingWindow() {
    return floatingWindow?.isVisible() ? hideFloatingWindow() : showFloatingWindow();
  }

  function setFloatingMode(mode) {
    if (!floatingWindow || !(mode in FLOATING_SIZES)) return false;
    const [width, height] = FLOATING_SIZES[mode];
    floatingWindow.setSize(width, height, false);
    floatingMode = mode;
    return true;
  }

  return {
    createWindows,
    getMainWindow: () => mainWindow,
    getFloatingWindow: () => floatingWindow,
    getFloatingState: () => ({ mode: floatingMode, visible: floatingWindow?.isVisible() ?? false }),
    hideFloatingWindow,
    prepareToQuit: () => {
      quitting = true;
    },
    setFloatingMode,
    showFloatingWindow,
    toggleFloatingWindow,
  };
}

module.exports = { createWindowManager };
