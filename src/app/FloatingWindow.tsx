import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Card } from '../components/Card';
import { NoteComposer } from '../components/NoteComposer';

function resolveTheme(theme: AppSettings['theme']): 'light' | 'dark' {
  return theme === 'system' && typeof matchMedia === 'function'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme === 'dark' ? 'dark' : 'light';
}

export function FloatingWindow() {
  const draggingRef = useRef(false);
  const dragRafRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startScreenX: number;
    startScreenY: number;
    originX: number | null;
    originY: number | null;
    latestScreenX: number;
    latestScreenY: number;
  } | null>(null);

  const [feedback, setFeedback] = useState('');
  const [isMini, setIsMini] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const loadFloatingState = useCallback(async () => {
    const [state, settings] = await Promise.all([
      window.desktop.getFloatingState(),
      window.desktop.getSettings?.() ?? Promise.resolve({
        schemaVersion: 1,
        theme: 'light',
        floatingShortcut: 'Alt+J',
        defaultCategoryId: null,
        onboardingDismissed: false,
      } as AppSettings),
    ]);
    setIsMini(state.mode === 'mini');
    setTheme(resolveTheme(settings.theme));
  }, []);

  useEffect(() => {
    if (!window.desktop) return;
    void loadFloatingState().catch(() => setFeedback('读取浮窗状态失败，请重试。'));
    const removeShownListener = window.desktop.onFloatingShown(() => {
      void loadFloatingState().catch(() => setFeedback('读取浮窗状态失败，请重试。'));
    });
    const removeStateListener = window.desktop.onFloatingStateChanged((state) => {
      setIsMini(state.mode === 'mini');
    });
    return () => {
      removeShownListener();
      removeStateListener();
    };
  }, [loadFloatingState]);

  useEffect(() => {
    if (!window.desktop?.onSettingsChanged) return;
    return window.desktop.onSettingsChanged((settings) => {
      setTheme(resolveTheme(settings.theme));
    });
  }, []);

  useEffect(() => {
    if (typeof matchMedia !== 'function' || !window.desktop?.getSettings) return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      void window.desktop.getSettings().then((settings) => {
        if (settings.theme === 'system') setTheme(resolveTheme('system'));
      });
    };
    media.addEventListener?.('change', listener);
    return () => media.removeEventListener?.('change', listener);
  }, []);

  async function setMode(mode: FloatingMode) {
    if (!window.desktop) return;
    try {
      await window.desktop.setFloatingMode(mode);
      setIsMini(mode === 'mini');
    } catch {
      setFeedback('浮窗大小调整失败，请重试。');
    }
  }

  async function onMiniPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draggingRef.current = true;
    const dragState = {
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      originX: null,
      originY: null,
      latestScreenX: event.screenX,
      latestScreenY: event.screenY,
    };
    dragStateRef.current = dragState;

    const bounds = await window.desktop.getFloatingBounds?.();
    if (!bounds || !draggingRef.current || dragStateRef.current !== dragState) return;
    dragState.originX = bounds.x;
    dragState.originY = bounds.y;
    scheduleMiniPosition();
  }

  function scheduleMiniPosition() {
    if (dragRafRef.current != null) return;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      const dragState = dragStateRef.current;
      if (!draggingRef.current || !dragState || dragState.originX == null || dragState.originY == null) return;
      const nextX = dragState.originX + dragState.latestScreenX - dragState.startScreenX;
      const nextY = dragState.originY + dragState.latestScreenY - dragState.startScreenY;
      window.desktop.setFloatingPosition?.(
        nextX, nextY, dragState.latestScreenX, dragState.latestScreenY, false,
      );
    });
  }

  function onMiniPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const dragState = dragStateRef.current;
    if (!draggingRef.current || !dragState || event.pointerId !== dragState.pointerId) return;
    dragState.latestScreenX = event.screenX;
    dragState.latestScreenY = event.screenY;
    scheduleMiniPosition();
  }

  function onMiniPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const dragState = dragStateRef.current;
    if (!draggingRef.current || !dragState || event.pointerId !== dragState.pointerId) return;
    dragState.latestScreenX = event.screenX;
    dragState.latestScreenY = event.screenY;
    if (dragRafRef.current != null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    if (dragState.originX != null && dragState.originY != null) {
      const nextX = dragState.originX + dragState.latestScreenX - dragState.startScreenX;
      const nextY = dragState.originY + dragState.latestScreenY - dragState.startScreenY;
      window.desktop.setFloatingPosition?.(
        nextX, nextY, dragState.latestScreenX, dragState.latestScreenY, true,
      );
    }
    draggingRef.current = false;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  }

  function onMiniDoubleClick() {
    void setMode('expanded');
  }

  if (isMini) {
    return (
      <div className="floating-shell floating-shell--mini window-no-drag" data-theme={theme}>
        <div className="floating-mini window-no-drag">
          <button
            aria-label="展开笔记浮窗"
            className="floating-mini-button window-no-drag"
            onDoubleClick={onMiniDoubleClick}
            onPointerDown={onMiniPointerDown}
            onPointerMove={onMiniPointerMove}
            onPointerUp={onMiniPointerUp}
            type="button"
          >
            <span aria-hidden="true" className="floating-mini-icon">记</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="floating-shell" data-theme={theme}>
      <Card className="floating-card">
        <header className="floating-card__header window-drag">
          <div>
            <span className="floating-card__caption">Quick Note</span>
          </div>
          <div className="floating-card__window-actions window-no-drag">
            <button aria-label="折叠浮窗" onClick={() => void setMode('mini')} type="button">
              <span aria-hidden="true" className="window-minimize-icon" />
            </button>
            <button
              aria-label="隐藏浮窗"
              onClick={() => void window.desktop?.hideFloatingWindow()}
              type="button"
            >
              <span aria-hidden="true" className="window-close-icon" />
            </button>
          </div>
        </header>

        <NoteComposer autoFocus className="window-no-drag" variant="compact" />
        {feedback ? <p aria-live="polite" className="floating-feedback">{feedback}</p> : null}
      </Card>
    </div>
  );
}
