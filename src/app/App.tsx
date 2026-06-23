import { useEffect, useState } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import type { PageId } from '../components/Sidebar';
import { CategoriesPage } from '../pages/CategoriesPage';
import { LibraryPage } from '../pages/LibraryPage';
import { SettingsPage } from '../pages/SettingsPage';
import { TodayPage } from '../pages/TodayPage';

const pages = {
  today: TodayPage,
  library: LibraryPage,
  categories: CategoriesPage,
  settings: SettingsPage,
};

export function App() {
  const [activePage, setActivePage] = useState<PageId>('today');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [settings,setSettings]=useState<AppSettings|null>(null);
  const ActivePage = pages[activePage];

  useEffect(()=>{
    if(!window.desktop?.getSettings) return;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    let current: AppSettings | null = null;
    const apply=(value:AppSettings)=>{
      current=value;
      setSettings(value);
      setTheme(value.theme==='system'?(media?.matches?'dark':'light'):value.theme);
    };
    const applySystemTheme=()=>{
      if(current?.theme==='system') setTheme(media?.matches?'dark':'light');
    };
    void window.desktop.getSettings().then(apply);
    const unsubscribe=window.desktop.onSettingsChanged(apply);
    media?.addEventListener?.('change',applySystemTheme);
    return ()=>{
      unsubscribe();
      media?.removeEventListener?.('change',applySystemTheme);
    };
  },[]);

  useEffect(() => {
    void window.desktop?.setTitleBarTheme?.(theme);
  }, [theme]);

  return (
    <AppLayout
      activePage={activePage}
      onNavigate={setActivePage}
      theme={theme}
    >
      {settings && !settings.onboardingDismissed ? <section className="onboarding"><div><strong>五步开始记录</strong><p>用浮窗记录文字；粘贴或拖入图片；选择分类和标签；在知识库搜索整理；定期导出和备份。</p></div><button onClick={()=>void window.desktop.updateSettings({onboardingDismissed:true}).then(setSettings)} type="button">知道了</button></section>:null}
      <ActivePage />
    </AppLayout>
  );
}
