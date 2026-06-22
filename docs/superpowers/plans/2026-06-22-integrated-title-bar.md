# Integrated Title Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the main window's black native chrome and integrate native Windows window controls into the themed application surface.

**Architecture:** Configure only the main `BrowserWindow` with Electron's hidden title bar and native overlay. Keep theme-to-overlay synchronization behind one narrow preload method, and add one renderer title-bar row whose draggable area respects the native controls' safe region.

**Tech Stack:** Electron 42, React 19, TypeScript, CSS, Node test runner, Vitest

---

### Task 1: Main-window chrome configuration

**Files:**
- Modify: `electron/window-manager.test.cjs`
- Modify: `electron/window-manager.cjs`

- [ ] **Step 1: Write a failing main-window configuration test**

Assert that the main window has `titleBarStyle: 'hidden'`, a light `titleBarOverlay`, and that `removeMenu()` is invoked, while the floating window retains `frame: false`.

- [ ] **Step 2: Run the focused Electron test**

Run: `node --test electron/window-manager.test.cjs`
Expected: FAIL because the main window has no title-bar overlay and the fake window does not record menu removal.

- [ ] **Step 3: Add the native overlay configuration**

Add `titleBarStyle: 'hidden'` and `titleBarOverlay: { color: '#f8f9fc', symbolColor: '#1f2a44', height: 40 }` to the main window, then call `mainWindow.removeMenu()` after construction.

- [ ] **Step 4: Re-run the focused test**

Run: `node --test electron/window-manager.test.cjs`
Expected: PASS.

### Task 2: Theme synchronization bridge

**Files:**
- Modify: `electron/window-manager.test.cjs`
- Modify: `electron/window-manager.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/desktop.d.ts`

- [ ] **Step 1: Write a failing overlay-update test**

Extend `FakeBrowserWindow` with `setTitleBarOverlay()` recording and assert that `manager.setMainWindowTheme('dark')` applies `{ color: '#171b25', symbolColor: '#f4f6fb', height: 40 }`; assert the light palette for `'light'` and reject unsupported values.

- [ ] **Step 2: Run the focused Electron test**

Run: `node --test electron/window-manager.test.cjs`
Expected: FAIL because `setMainWindowTheme` does not exist.

- [ ] **Step 3: Implement and expose theme updates**

Add `setMainWindowTheme(theme)` to the manager, register `ipcMain.handle('window:set-title-bar-theme', ...)`, expose `setTitleBarTheme(theme)` from the preload bridge, and type it as `(theme: 'light' | 'dark') => Promise<boolean>`.

- [ ] **Step 4: Re-run the focused Electron test**

Run: `node --test electron/window-manager.test.cjs`
Expected: PASS.

### Task 3: Renderer title-bar surface

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/layouts/AppLayout.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Write failing renderer tests**

Assert that the main application renders a `data-testid="app-title-bar"` element and that the desktop bridge receives the active theme through `setTitleBarTheme` when the app initializes and when the theme changes.

- [ ] **Step 2: Run the focused renderer test**

Run: `npx vitest run src/app/App.test.tsx`
Expected: FAIL because the title-bar row and bridge method are absent.

- [ ] **Step 3: Add the themed draggable row**

Render `<div className="app-title-bar window-drag" data-testid="app-title-bar" />` above the sidebar and main content. Use a two-row grid so the 40px title bar spans the window, extend sidebar/main theme backgrounds into that row, and reserve `env(titlebar-area-width)` on the right with a fallback. Call `window.desktop?.setTitleBarTheme?.(theme)` from a theme effect.

- [ ] **Step 4: Re-run the focused renderer test**

Run: `npx vitest run src/app/App.test.tsx`
Expected: PASS.

### Task 4: Full verification

**Files:**
- Verify only

- [ ] **Step 1: Run all automated checks**

Run: `npm test`
Expected: all Vitest and Node tests pass.

- [ ] **Step 2: Run type checking and production build**

Run: `npm run build`
Expected: TypeScript checks pass and Vite creates the production bundle.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check` and inspect only the title-bar hunks, confirming unrelated floating-window changes remain intact.

- [ ] **Step 4: Perform a visual smoke check**

Run the Electron application and confirm the black chrome is absent, native minimize/maximize/close controls remain usable, the 40px surface drags and double-clicks correctly, and light/dark symbols remain legible.

