function registerFloatingShortcut(globalShortcut, onToggle) {
  try {
    return globalShortcut.register('Alt+J', onToggle);
  } catch (error) {
    console.warn('Alt+J global shortcut registration failed.', error);
    return false;
  }
}

function createShortcutManager(globalShortcut, onToggle) {
  let current = null;
  function registerInitial(shortcut) {
    try {
      const ok = globalShortcut.register(shortcut, onToggle);
      if (ok) current = shortcut;
      return ok;
    } catch { return false; }
  }
  function replace(shortcut) {
    const previous = current;
    if (previous) globalShortcut.unregister(previous);
    if (registerInitial(shortcut)) return { ok: true, shortcut };
    current = null;
    if (previous) registerInitial(previous);
    return { ok: false, shortcut: previous };
  }
  return { registerInitial, replace, getCurrent: () => current };
}

module.exports = { createShortcutManager, registerFloatingShortcut };
