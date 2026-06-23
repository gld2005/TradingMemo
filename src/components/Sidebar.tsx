export type PageId = 'today' | 'library' | 'categories' | 'settings';

type SidebarProps = {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  onCollapse: () => void;
};

const navigation: Array<{ id: PageId; label: string }> = [
  { id: 'today', label: '今日记录' },
  { id: 'library', label: '知识库' },
  { id: 'categories', label: '分类' },
  { id: 'settings', label: '设置' },
];

export function Sidebar({
  activePage,
  onNavigate,
  onCollapse,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true">记</span>
        <div>
          <strong>学习笔记</strong>
          <span>A 股学习记录</span>
        </div>
        <button
          aria-label="收起侧边栏"
          className="sidebar__collapse"
          onClick={onCollapse}
          title="收起侧边栏"
          type="button"
        >
          ‹
        </button>
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

      <div className="sidebar__footer" aria-hidden="true" />
    </aside>
  );
}
