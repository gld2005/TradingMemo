import { Button } from './Button';

export type PageId = 'today' | 'library' | 'categories' | 'settings';

type SidebarProps = {
  activePage: PageId;
  floatingVisible: boolean;
  onNavigate: (page: PageId) => void;
  onToggleFloating: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  shortcutRegistered: boolean;
};

const navigation: Array<{ id: PageId; label: string }> = [
  { id: 'today', label: '今日记录' },
  { id: 'library', label: '知识库' },
  { id: 'categories', label: '分类' },
  { id: 'settings', label: '设置' },
];

export function Sidebar({
  activePage,
  floatingVisible,
  onNavigate,
  onToggleFloating,
  theme,
  onToggleTheme,
  shortcutRegistered,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true">记</span>
        <div>
          <strong>学习笔记</strong>
          <span>A 股学习记录</span>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="主要导航">
        {navigation.map((item) => (
          <button
            className="sidebar__nav-item"
            data-active={activePage === item.id}
            key={item.id}
            onClick={() => onNavigate(item.id)}
            type="button"
          >
            <span className="sidebar__nav-dot" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar__footer">
        <Button onClick={onToggleFloating} variant="primary">
          {floatingVisible ? '隐藏浮窗' : '显示浮窗'}
        </Button>
        <p>{shortcutRegistered ? '快捷键 Alt + J' : '快捷键不可用，可使用上方按钮'}</p>
        <Button
          aria-label={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
          onClick={onToggleTheme}
          variant="secondary"
        >
          <span aria-hidden="true">{theme === 'light' ? '◐' : '◑'}</span>
          {theme === 'light' ? '深色主题' : '浅色主题'}
        </Button>
        <p>主题设置保存在本地</p>
      </div>
    </aside>
  );
}
