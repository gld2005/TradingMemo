import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';

const fallbackSettings: AppSettings = {
  schemaVersion: 1,
  theme: 'light',
  floatingShortcut: 'Alt+J',
  defaultCategoryId: null,
  onboardingDismissed: false,
};

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dataDirectory, setDataDirectory] = useState('');
  const [shortcut, setShortcut] = useState('Alt+J');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!window.desktop?.getSettings) {
      setSettings(fallbackSettings);
      return;
    }

    void Promise.all([
      window.desktop.getSettings(),
      window.desktop.getCategories(),
      window.desktop.getStorageInfo(),
    ])
      .then(([loadedSettings, loadedCategories, storage]) => {
        setSettings(loadedSettings);
        setShortcut(loadedSettings.floatingShortcut);
        setCategories(loadedCategories);
        setDataDirectory(storage.dataFilePath.replace(/[\\/]notes\.json$/, ''));
      })
      .catch(() => setFeedback('读取设置失败，请重试。'));
  }, []);

  async function save(patch: Partial<AppSettings>, success = '设置已保存。') {
    try {
      const next = await window.desktop.updateSettings(patch);
      setSettings(next);
      setShortcut(next.floatingShortcut);
      setFeedback(success);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '保存失败，请重试。');
    }
  }

  async function runFileAction(run: () => Promise<string | null>, name: string) {
    try {
      const result = await run();
      setFeedback(result ? `${name}完成：${result}` : `已取消${name}。`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : `${name}失败。`);
    }
  }

  async function copyDataDirectory() {
    try {
      await navigator.clipboard.writeText(dataDirectory);
      setFeedback('数据路径已复制。');
    } catch {
      setFeedback('无法复制数据路径，请重试。');
    }
  }

  async function restore() {
    if (!confirm('恢复会覆盖当前数据。继续前将自动创建安全备份，确定恢复吗？')) return;

    try {
      const result = await window.desktop.restoreData();
      if (!result) {
        setFeedback('已取消恢复。');
        return;
      }
      const warning = result.warning ? `；注意：${result.warning}` : '';
      setFeedback(`恢复完成，原数据安全备份：${result.safetyBackupPath}${warning}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '恢复失败。');
    }
  }

  if (!settings) {
    return (
      <div className="page">
        <PageHeader title="设置" description="正在读取本地设置…" />
        <Card>{feedback || '正在加载…'}</Card>
      </div>
    );
  }

  return (
    <div className="page settings-page">
      <PageHeader title="设置" description="管理外观、浮窗与本地数据。" />
      <div className="settings-grid">
        <Card className="settings-card">
          <div className="settings-card__header">
            <h2>偏好设置</h2>
            <p>调整应用外观与新记录的默认值。</p>
          </div>
          <div className="settings-field-grid">
            <label>
              主题
              <select
                aria-label="主题"
                value={settings.theme}
                onChange={(event) => void save({ theme: event.target.value as AppSettings['theme'] })}
              >
                <option value="light">浅色</option>
                <option value="dark">深色</option>
                <option value="system">跟随系统</option>
              </select>
            </label>
            <label>
              默认分类
              <select
                aria-label="默认分类"
                value={settings.defaultCategoryId || ''}
                onChange={(event) => void save({ defaultCategoryId: event.target.value || null })}
              >
                <option value="">未分类</option>
                {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
              </select>
            </label>
          </div>
        </Card>

        <Card className="settings-card">
          <div className="settings-card__header">
            <h2>浮窗设置</h2>
            <p>设置快速显示或隐藏浮窗的快捷键。</p>
          </div>
          <label>
            显示/隐藏快捷键
            <input aria-label="浮窗快捷键" value={shortcut} onChange={(event) => setShortcut(event.target.value)} />
          </label>
          <div className="settings-actions">
            <Button onClick={() => void save({ floatingShortcut: shortcut }, '快捷键已更新。')}>保存快捷键</Button>
            <Button variant="secondary" onClick={() => void save({ floatingShortcut: 'Alt+J' }, '已恢复 Alt+J。')}>
              恢复默认
            </Button>
          </div>
        </Card>

        <Card className="settings-card settings-card--wide">
          <div className="settings-card__header">
            <h2>数据管理</h2>
            <p>查看数据位置，或导出、备份和恢复本地数据。所有操作均在本地完成。</p>
          </div>
          <div className="settings-path">
            <span>数据位置</span>
            <code>{dataDirectory}</code>
            <div className="settings-actions">
              <Button
                variant="secondary"
                onClick={() => void window.desktop.openDataDirectory().catch(() => setFeedback('无法打开数据目录。'))}
              >
                打开数据目录
              </Button>
              <Button variant="ghost" onClick={() => void copyDataDirectory()}>复制路径</Button>
            </div>
          </div>
          <div className="settings-divider" />
          <div className="settings-actions">
            <Button onClick={() => void runFileAction(() => window.desktop.exportMarkdown(), 'Markdown 导出')}>导出 Markdown</Button>
            <Button variant="secondary" onClick={() => void runFileAction(() => window.desktop.exportJson(), 'JSON 导出')}>导出 JSON</Button>
            <Button variant="secondary" onClick={() => void runFileAction(() => window.desktop.backupData(), '备份')}>备份数据</Button>
            <Button variant="ghost" onClick={() => void restore()}>从备份恢复</Button>
          </div>
        </Card>

        <Card className="settings-card settings-card--wide settings-about">
          <h2>关于 Trading Memo</h2>
          <strong>版本 0.1.1</strong>
          <p>Windows 桌面浮窗版 A 股学习笔记软件。数据仅保存在本地。</p>
          <p>本软件仅用于学习笔记和个人经验记录，不提供投资建议，不推荐股票，不进行自动交易。</p>
        </Card>
      </div>
      <p aria-live="polite" className="settings-feedback">{feedback}</p>
    </div>
  );
}
