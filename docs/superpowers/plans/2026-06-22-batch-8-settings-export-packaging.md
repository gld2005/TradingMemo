# Batch 8 Settings, Export, and Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Batch 8 with persistent local settings, safe local export/backup/restore, a finished settings UI, onboarding, and an offline Windows installer.

**Architecture:** Keep all filesystem and global-shortcut work in focused Electron main-process services. Expose only bounded IPC methods through the existing preload bridge; React owns presentation and immediate theme state while the main process owns persistence, validation, file dialogs, and recovery guarantees.

**Tech Stack:** Electron 42, React 19, TypeScript 6, Vite 8, Vitest, Node test runner, electron-builder.

---

### Task 1: Persistent settings service

**Files:**
- Create: `electron/settings-service.cjs`
- Create: `electron/settings-service.test.cjs`

- [ ] **Step 1: Write failing tests** for missing-file defaults, atomic writes, invalid-value normalization, and a missing default category falling back to `null`.
- [ ] **Step 2: Run `node --test electron/settings-service.test.cjs`** and verify failure because the module does not exist.
- [ ] **Step 3: Implement `createSettingsService({ dataDirectory, fileSystem })`** with `getSettings`, `updateSettings`, `replaceSettings`, `settingsFilePath`, schema version 1, and defaults `{ theme: 'light', floatingShortcut: 'Alt+J', defaultCategoryId: null, onboardingDismissed: false }`.
- [ ] **Step 4: Re-run the focused test** and verify all cases pass.

### Task 2: Reconfigurable shortcut manager

**Files:**
- Modify: `electron/shortcut-manager.cjs`
- Modify: `electron/shortcut-manager.test.cjs`

- [ ] **Step 1: Add failing tests** proving a custom accelerator registers, a failed replacement restores the previous accelerator, and restoring `Alt+J` works.
- [ ] **Step 2: Run `node --test electron/shortcut-manager.test.cjs`** and verify the new API tests fail.
- [ ] **Step 3: Replace the fixed helper with `createShortcutManager`**, exposing `registerInitial`, `replace`, `getCurrent`, and `unregister`; persist only after registration succeeds.
- [ ] **Step 4: Re-run focused tests** and verify pass.

### Task 3: Export and backup service

**Files:**
- Create: `electron/data-portability-service.cjs`
- Create: `electron/data-portability-service.test.cjs`

- [ ] **Step 1: Write failing tests** for Windows-safe unique filenames, Markdown metadata and relative image paths, complete JSON payloads, attachment copying, timestamped backup structure, invalid backup rejection, safety backup before restore, and rollback on replacement failure.
- [ ] **Step 2: Run `node --test electron/data-portability-service.test.cjs`** and verify failure because the module does not exist.
- [ ] **Step 3: Implement pure helpers** `sanitizeFileName`, `buildMarkdown`, and timestamp naming, then implement `exportMarkdown`, `exportJson`, `backup`, `validateBackup`, and `restore` using injected filesystem/path selection dependencies.
- [ ] **Step 4: Re-run focused tests** and verify pass, including failure-path assertions that original data remains readable.

### Task 4: Main-process integration and safe IPC

**Files:**
- Create: `electron/settings-ipc.cjs`
- Create: `electron/settings-ipc.test.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/notes-ipc.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/desktop.d.ts`

- [ ] **Step 1: Write failing IPC registration tests** for settings read/update, shortcut update, data-directory opening, directory-picked exports/backup, backup selection/validation, and confirmed restore.
- [ ] **Step 2: Run the focused Node tests** and verify missing handlers fail.
- [ ] **Step 3: Implement bounded handlers** using Electron `dialog` and `shell`, settings/portability services, and settings/notes broadcasts; never accept arbitrary renderer paths for opening or export targets.
- [ ] **Step 4: Wire startup** so settings are initialized before windows, the saved shortcut is registered, and current shortcut/theme information is broadcast.
- [ ] **Step 5: Extend preload and TypeScript declarations** with exact typed methods and event cleanup functions.
- [ ] **Step 6: Re-run all Electron tests** with `node --test electron/*.test.cjs`.

### Task 5: Settings page and application theme/onboarding

**Files:**
- Create: `src/pages/SettingsPage.test.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/layouts/AppLayout.tsx`
- Modify: `src/styles/global.css`
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Write failing React tests** for the six required sections, loading state, theme persistence, shortcut save/default/error feedback, default-category save, data path/open action, export/backup success and failure messages, restore confirmation, onboarding dismissal, and about/disclaimer content.
- [ ] **Step 2: Run `npm test -- --run src/pages/SettingsPage.test.tsx src/app/App.test.tsx`** and verify failures reflect missing UI behavior.
- [ ] **Step 3: Implement settings state in `App`** so persisted settings load before rendering, `light`/`dark`/`system` resolve immediately, and settings broadcasts synchronize windows.
- [ ] **Step 4: Build the six-card settings page** using existing controls and concise feedback; use `window.confirm` before restore.
- [ ] **Step 5: Add a dismissible first-use guide** to the main layout and persist dismissal.
- [ ] **Step 6: Add scoped responsive styles** and verify both themes use existing tokens without a new design system.
- [ ] **Step 7: Re-run focused React tests** and verify pass.

### Task 6: Floating-window defaults and theme synchronization

**Files:**
- Modify: `src/app/FloatingWindow.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: Add failing tests** proving a valid configured default category is selected, a missing category becomes unclassified, and persisted theme applies to expanded and mini floating modes.
- [ ] **Step 2: Run focused tests** and verify expected failures.
- [ ] **Step 3: Load categories, tags, and settings together** while preserving an active valid draft selection; reset a newly saved draft to the configured default.
- [ ] **Step 4: Subscribe to settings changes** and apply resolved theme to both floating roots.
- [ ] **Step 5: Re-run focused tests** and verify pass.

### Task 7: Windows packaging

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add `electron-builder` as a dev dependency** and configure app ID, product name, Windows x64 target, NSIS offline installer, output directory, and included production files.
- [ ] **Step 2: Add scripts** `package:win` for a local Windows package and `dist:win` for tests, production build, then package.
- [ ] **Step 3: Run `npm run package:win`** and verify the Windows artifact is produced without updater or remote publishing configuration.

### Task 8: Documentation and acceptance checklist

**Files:**
- Modify: `README.md`
- Modify: `docs/03_ACCEPTANCE_CHECKLIST.md`
- Modify: `docs/05_TECHNICAL_BOUNDARY.md`
- Modify: `data/README.md`

- [ ] **Step 1: Document** project positioning, completed local features, explicit exclusions, development/check commands, Windows package command, exact data location, exports, backup, and overwrite restore safety.
- [ ] **Step 2: Expand Batch 8 checklist** without changing the eight-Batch order or adding Batch 9.
- [ ] **Step 3: Record Batch 8 technical boundaries** including no network, no updater, separate settings file, bounded IPC, and folder-copy backup.

### Task 9: Full verification and scope audit

**Files:**
- Inspect all modified files.

- [ ] **Step 1: Run `npm test`** and require zero failures.
- [ ] **Step 2: Run `npm run typecheck`** and require exit code 0.
- [ ] **Step 3: Run `npm run build`** and require exit code 0.
- [ ] **Step 4: Run `npm run package:win`** and inspect the produced artifact.
- [ ] **Step 5: Review the full diff and Batch 8 checklist** for accidental AI, market, trading, cloud, account, updater, telemetry, or Batch 9 scope.
- [ ] **Step 6: Report exact modified files, verification evidence, packaging output, limitations, and final acceptance recommendations; then stop.**
