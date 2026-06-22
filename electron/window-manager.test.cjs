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
}

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

  assert.equal(floatingWindow.options.alwaysOnTop, true);
  assert.equal(floatingWindow.options.frame, false);
  assert.equal(floatingWindow.options.resizable, false);
  assert.deepEqual(floatingWindow.size, [380, 640]);

  manager.toggleFloatingWindow();
  assert.equal(floatingWindow.visible, false);
  manager.toggleFloatingWindow();
  assert.equal(floatingWindow.visible, true);
  assert.equal(floatingWindow.focused, true);

  manager.setFloatingMode('mini');
  assert.deepEqual(floatingWindow.size, [104, 52]);
  manager.setFloatingMode('expanded');
  assert.deepEqual(floatingWindow.size, [380, 640]);
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
