const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { createWindowManager } = require('./window-manager.cjs');

class FakeBrowserWindow extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.visible = options.show !== false;
    this.size = [options.width, options.height];
    this.focused = false;
    this.hasWindowShadow = options.hasShadow;
    this.menuRemoved = false;
  }

  hide() {
    this.visible = false;
  }

  show() {
    this.visible = true;
  }

  focus() {
    this.focused = true;
  }

  isVisible() {
    return this.visible;
  }

  setSize(width, height) {
    this.size = [width, height];
  }

  setContentSize(width, height) {
    this.size = [width, height];
  }

  setMinimumSize(width, height) {
    this.minimumSize = [width, height];
  }

  setHasShadow(hasShadow) {
    this.hasWindowShadow = hasShadow;
  }

  setTitleBarOverlay(overlay) {
    this.titleBarOverlay = overlay;
  }

  removeMenu() {
    this.menuRemoved = true;
  }
}

test('integrates native window controls into the main window surface', () => {
  const manager = createWindowManager({
    BrowserWindow: FakeBrowserWindow,
    loadRenderer: () => undefined,
  });
  const { mainWindow, floatingWindow } = manager.createWindows();

  assert.equal(mainWindow.options.titleBarStyle, 'hidden');
  assert.deepEqual(mainWindow.options.titleBarOverlay, {
    color: '#f8f9fc',
    symbolColor: '#1f2a44',
    height: 40,
  });
  assert.equal(mainWindow.menuRemoved, true);
  assert.equal(floatingWindow.options.frame, false);
});

test('updates native title bar colors with the application theme', () => {
  const manager = createWindowManager({
    BrowserWindow: FakeBrowserWindow,
    loadRenderer: () => undefined,
  });
  const { mainWindow } = manager.createWindows();

  assert.equal(manager.setMainWindowTheme('dark'), true);
  assert.deepEqual(mainWindow.titleBarOverlay, {
    color: '#171b25',
    symbolColor: '#f4f6fb',
    height: 40,
  });
  assert.equal(manager.setMainWindowTheme('light'), true);
  assert.deepEqual(mainWindow.titleBarOverlay, {
    color: '#f8f9fc',
    symbolColor: '#1f2a44',
    height: 40,
  });
  assert.equal(manager.setMainWindowTheme('system'), false);
});

test('retains both windows until each window closes', () => {
  const loadedWindows = [];
  const manager = createWindowManager({
    BrowserWindow: FakeBrowserWindow,
    loadRenderer: (window, query) => loadedWindows.push({ window, query }),
  });

  const created = manager.createWindows();

  assert.equal(manager.getMainWindow(), created.mainWindow);
  assert.equal(manager.getFloatingWindow(), created.floatingWindow);
  assert.equal(loadedWindows.length, 2);

  created.mainWindow.emit('closed');
  assert.equal(manager.getMainWindow(), null);
  assert.equal(manager.getFloatingWindow(), created.floatingWindow);

  created.floatingWindow.emit('closed');
  assert.equal(manager.getFloatingWindow(), null);
});

test('configures and controls one always-on-top floating window', () => {
  const manager = createWindowManager({
    BrowserWindow: FakeBrowserWindow,
    loadRenderer: () => undefined,
  });
  const { floatingWindow } = manager.createWindows();

  assert.equal(floatingWindow.options.show, false);
  assert.equal(floatingWindow.visible, false);
  assert.equal(floatingWindow.options.alwaysOnTop, true);
  assert.equal(floatingWindow.options.frame, false);
  assert.equal(floatingWindow.options.resizable, false);
  assert.deepEqual(floatingWindow.size, [380, 430]);

  manager.toggleFloatingWindow();
  assert.equal(floatingWindow.visible, true);
  assert.equal(floatingWindow.focused, true);
  manager.toggleFloatingWindow();
  assert.equal(floatingWindow.visible, false);

  assert.equal(manager.setFloatingMode('mini'), true);
  assert.deepEqual(floatingWindow.size, [80, 80]);
  assert.equal(floatingWindow.hasWindowShadow, false);
  assert.equal(manager.getFloatingState().mode, 'mini');
  assert.equal(manager.setFloatingMode('expanded'), true);
  assert.deepEqual(floatingWindow.size, [380, 430]);
  assert.equal(floatingWindow.hasWindowShadow, true);
  assert.equal(manager.getFloatingState().mode, 'expanded');
  assert.equal(manager.setFloatingMode('unknown'), false);
});

test('hides the floating window instead of destroying it on close', () => {
  const visibilityChanges = [];
  const manager = createWindowManager({
    BrowserWindow: FakeBrowserWindow,
    loadRenderer: () => undefined,
    onFloatingVisibilityChanged: (visible) => visibilityChanges.push(visible),
  });
  const { floatingWindow } = manager.createWindows();
  let prevented = false;

  floatingWindow.emit('close', {
    preventDefault: () => {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.equal(floatingWindow.visible, false);
  assert.equal(manager.getFloatingWindow(), floatingWindow);
  assert.deepEqual(visibilityChanges, [false]);
});
