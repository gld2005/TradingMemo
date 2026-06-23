import { useState, type ReactNode } from 'react';
import { Sidebar, type PageId } from '../components/Sidebar';

type AppLayoutProps = {
  activePage: PageId;
  children: ReactNode;
  onNavigate: (page: PageId) => void;
  theme: 'light' | 'dark';
};

export function AppLayout({
  activePage,
  children,
  onNavigate,
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
          onCollapse={() => setSidebarCollapsed(true)}
          onNavigate={onNavigate}
        />
      )}
      <main className="main-content">{children}</main>
    </div>
  );
}
