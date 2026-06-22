const assert = require('node:assert/strict');
const test = require('node:test');
const { registerFloatingShortcut } = require('./shortcut-manager.cjs');
const { createShortcutManager } = require('./shortcut-manager.cjs');

test('registers Alt+J and toggles the floating window', () => {
  let accelerator;
  let callback;
  let toggles = 0;
  const globalShortcut = {
    register: (value, handler) => {
      accelerator = value;
      callback = handler;
      return true;
    },
  };

  const registered = registerFloatingShortcut(globalShortcut, () => {
    toggles += 1;
  });

  assert.equal(registered, true);
  assert.equal(accelerator, 'Alt+J');
  callback();
  assert.equal(toggles, 1);
});

test('reports a failed shortcut registration without throwing', () => {
  const globalShortcut = { register: () => false };

  assert.equal(registerFloatingShortcut(globalShortcut, () => undefined), false);
});

test('replaces a shortcut and restores the previous one when registration fails', () => {
  const registered = new Set();
  const globalShortcut = {
    register(value) { if (value === 'Bad') return false; registered.add(value); return true; },
    unregister(value) { registered.delete(value); },
  };
  const manager = createShortcutManager(globalShortcut, () => undefined);
  assert.equal(manager.registerInitial('Alt+J'), true);
  assert.deepEqual(manager.replace('Ctrl+M'), { ok: true, shortcut: 'Ctrl+M' });
  assert.deepEqual(manager.replace('Bad'), { ok: false, shortcut: 'Ctrl+M' });
  assert.deepEqual([...registered], ['Ctrl+M']);
});
