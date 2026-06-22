import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

beforeEach(() => {
  Object.defineProperty(window, 'desktop', { configurable: true, value: {
    getSettings:vi.fn().mockResolvedValue({schemaVersion:1,theme:'light',floatingShortcut:'Alt+J',defaultCategoryId:null,onboardingDismissed:false}),
    getCategories:vi.fn().mockResolvedValue([]), getStorageInfo:vi.fn().mockResolvedValue({dataFilePath:'C:\\memo\\app-data\\notes.json'}),
    updateSettings:vi.fn().mockImplementation(async (patch) => ({schemaVersion:1,theme:'light',floatingShortcut:'Alt+J',defaultCategoryId:null,onboardingDismissed:false,...patch})),
    openDataDirectory:vi.fn(), exportMarkdown:vi.fn(), exportJson:vi.fn(), backupData:vi.fn(), restoreData:vi.fn(),
  }});
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

it('renders all Batch 8 settings sections and local-only disclaimer',async()=>{
  render(<SettingsPage/>);
  for(const name of ['偏好设置','浮窗设置','数据管理','关于 Trading Memo']) expect(await screen.findByText(name)).toBeInTheDocument();
  expect(screen.getByText(/不提供投资建议/)).toBeInTheDocument();
});

it('copies the local data directory and reports success', async () => {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  render(<SettingsPage />);

  await user.click(await screen.findByRole('button', { name: '复制路径' }));

  expect(writeText).toHaveBeenCalledWith('C:\\memo\\app-data');
  expect(await screen.findByText('数据路径已复制。')).toBeInTheDocument();
});

it('persists a theme selection and reports success', async () => {
  const user = userEvent.setup();
  render(<SettingsPage />);

  await user.selectOptions(await screen.findByLabelText('主题'), 'dark');

  expect(window.desktop.updateSettings).toHaveBeenCalledWith({ theme: 'dark' });
  expect(await screen.findByText('设置已保存。')).toBeInTheDocument();
});

it('keeps the entered shortcut and displays registration failures', async () => {
  const user = userEvent.setup();
  vi.mocked(window.desktop.updateSettings).mockRejectedValueOnce(new Error('快捷键已被其他程序占用。'));
  render(<SettingsPage />);

  const input = await screen.findByLabelText('浮窗快捷键');
  await user.clear(input);
  await user.type(input, 'Ctrl+Shift+M');
  await user.click(screen.getByRole('button', { name: '保存快捷键' }));

  expect(await screen.findByText('快捷键已被其他程序占用。')).toBeInTheDocument();
  expect(input).toHaveValue('Ctrl+Shift+M');
});

it('shows the safety backup and shortcut warning after restore', async () => {
  const user = userEvent.setup();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.mocked(window.desktop.restoreData).mockResolvedValueOnce({
    safetyBackupPath: 'C:\\memo\\backup-before-restore',
    warning: '恢复的快捷键不可用，已继续使用 Alt+J。',
  });
  render(<SettingsPage />);

  await user.click(await screen.findByRole('button', { name: '从备份恢复' }));

  expect(await screen.findByText(/backup-before-restore/)).toHaveTextContent('恢复的快捷键不可用');
});
