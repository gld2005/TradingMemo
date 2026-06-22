# Integrated title bar design

## Goal

Remove the main window's native black title bar and application menu so the app content reaches the top edge, while retaining familiar Windows minimize, maximize/restore, and close controls.

## Chosen approach

Use Electron's native title-bar overlay on the main `BrowserWindow`. Set `titleBarStyle` to `hidden`, enable `titleBarOverlay`, and remove the application menu. This keeps window movement, double-click-to-maximize, resizing, and system window controls native instead of recreating them through renderer IPC.

The floating window remains frameless and unchanged.

## Layout and appearance

- Reserve a compact title-bar row at the top of the main renderer layout.
- Make the non-interactive portion of that row draggable with `-webkit-app-region: drag`.
- Keep interactive content and the native Windows controls outside conflicting draggable/clickable regions.
- Extend the sidebar and main background colors into the title-bar row so the chrome looks like part of the application.
- Match overlay background and symbol colors to the active light or dark theme. Theme changes notify the main process so the native controls update without restarting.
- Respect Electron's title-bar overlay environment variables when sizing the right-side safe area, with a sensible fallback for browser-based tests.

## Integration

- The main process owns title-bar overlay configuration and removes the menu.
- The preload bridge exposes a narrowly scoped method for updating title-bar colors after theme changes.
- The React layout renders the draggable title-bar surface only for the main window.
- No note, storage, floating-window, or navigation behavior changes.

## Verification

- Extend window-manager tests to verify the main window uses the hidden title-bar overlay and has no menu.
- Extend renderer tests to verify the integrated title-bar region is present.
- Run unit tests, Electron tests, type checking, and the production build.
- Visually confirm that the black chrome is gone, all three native controls work, the window drags from the title-bar surface, and both themes use legible control colors.

