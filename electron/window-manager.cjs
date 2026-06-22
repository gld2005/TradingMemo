const FLOATING_SIZES = {
  expanded: [380, 430],
  mini: [80, 80],
};

const TITLE_BAR_OVERLAYS = {
  light: { color: '#f8f9fc', symbolColor: '#1f2a44', height: 40 },
  dark: { color: '#171b25', symbolColor: '#f4f6fb', height: 40 },
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
      titleBarStyle: 'hidden',
      titleBarOverlay: TITLE_BAR_OVERLAYS.light,
      title: 'Windows 桌面浮窗版 A 股学习笔记软件',
      webPreferences: sharedPreferences,
    });

    mainWindow.removeMenu();

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
    floatingWindow.setMinimumSize(80, 80);
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
  // 确保内容区大小与期望一致（比 setSize 更可靠，尤其是无框窗口）
  try {
    floatingWindow.setContentSize(width, height);
  } catch (e) {
    // 退回到 setSize 以保证兼容性
    floatingWindow.setSize(width, height, false);
  }
  floatingWindow.setHasShadow(mode !== 'mini');
  floatingMode = mode;
  // 可选：通知渲染进程最新状态，确保前端总是同步
  try {
    floatingWindow.webContents?.send?.('floating-state-changed', {
      mode: floatingMode,
      visible: floatingWindow?.isVisible() ?? false,
    });
  } catch (e) {}
  return true;
}

  function setMainWindowTheme(theme) {
    const overlay = TITLE_BAR_OVERLAYS[theme];
    if (!mainWindow || !overlay) return false;
    mainWindow.setTitleBarOverlay(overlay);
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
    setMainWindowTheme,
    showFloatingWindow,
    toggleFloatingWindow,
  };
}

module.exports = { createWindowManager };
