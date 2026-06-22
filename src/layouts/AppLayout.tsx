import type { ReactNode } from 'react';
import { Sidebar, type PageId } from '../components/Sidebar';

type AppLayoutProps = {
  activePage: PageId;
  children: ReactNode;
  floatingVisible: boolean;
  onNavigate: (page: PageId) => void;
  onToggleFloating: () => void;
  onToggleTheme: () => void;
  shortcutRegistered: boolean;
  theme: 'light' | 'dark';
};

export function AppLayout({
  activePage,
  children,
  floatingVisible,
  onNavigate,
  onToggleFloating,
  onToggleTheme,
  shortcutRegistered,
  theme,
}: AppLayoutProps) {
  return (
    <div className="app-shell" data-theme={theme} data-testid="app-shell">
      <div className="app-title-bar" data-testid="app-title-bar" aria-hidden="true" />
      <Sidebar
        activePage={activePage}
        floatingVisible={floatingVisible}
        onNavigate={onNavigate}
        onToggleFloating={onToggleFloating}
        onToggleTheme={onToggleTheme}
        shortcutRegistered={shortcutRegistered}
        theme={theme}
      />
      <main className="main-content">{children}</main>
    </div>
  );
}
