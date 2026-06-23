import { useState, type ReactNode } from 'react';
import { Sidebar, type PageId } from '../components/Sidebar';

type AppLayoutProps = {
  activePage: PageId;
  children: ReactNode;
  floatingVisible: boolean;
  onNavigate: (page: PageId) => void;
  onToggleFloating: () => void;
  shortcutRegistered: boolean;
  theme: 'light' | 'dark';
};

export function AppLayout({
  activePage,
  children,
  floatingVisible,
  onNavigate,
  onToggleFloating,
  shortcutRegistered,
  theme,
}: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className="app-shell"
      data-sidebar-collapsed={sidebarCollapsed}
      data-theme={theme}
      data-testid="app-shell"
    >
      <div className="app-title-bar" data-testid="app-title-bar" aria-hidden="true" />
      {sidebarCollapsed ? (
        <button
          aria-label="展开侧边栏"
          className="sidebar-expand"
          onClick={() => setSidebarCollapsed(false)}
          title="展开侧边栏"
          type="button"
        >
          ☰
        </button>
      ) : (
        <Sidebar
          activePage={activePage}
          floatingVisible={floatingVisible}
          onCollapse={() => setSidebarCollapsed(true)}
          onNavigate={onNavigate}
          onToggleFloating={onToggleFloating}
          shortcutRegistered={shortcutRegistered}
        />
      )}
      <main className="main-content">{children}</main>
    </div>
  );
}
