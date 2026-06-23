import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TodayPage } from './TodayPage';

function todayAt1630() {
  const value = new Date();
  value.setHours(16, 30, 0, 0);
  return value.toISOString();
}

describe('today notes storage verification', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'desktop', {
      configurable: true,
      value: {
        getAllNotes: vi.fn().mockResolvedValue([{
          id: 'note-1',
          title: '学习记录',
          content: '突破后回踩时需要观察成交量是否同步缩小。',
          categoryId: 'category-1',
          tagIds: [],
          stockName: null,
          stockCode: null,
          attachmentIds: [],
          createdAt: todayAt1630(),
          updatedAt: todayAt1630(),
        }]),
        getCategories: vi.fn().mockResolvedValue([
          { id: 'category-1', name: 'K线知识', color: null, sortOrder: 0 },
        ]),
        getTags: vi.fn().mockResolvedValue([{ id: 'tag-1', name: '突破', usageCount: 1 }]),
        getSettings: vi.fn().mockResolvedValue({
          schemaVersion: 1,
          theme: 'light',
          floatingShortcut: 'Alt+J',
          defaultCategoryId: null,
          onboardingDismissed: true,
        }),
        createNote: vi.fn().mockResolvedValue({ id: 'note-created' }),
        createTag: vi.fn().mockResolvedValue({ id: 'tag-2', name: '放量', usageCount: 0 }),
        getAttachments: vi.fn().mockResolvedValue([]),
        onNotesChanged: vi.fn().mockReturnValue(() => undefined),
        onSettingsChanged: vi.fn().mockReturnValue(() => undefined),
        readAttachment: vi.fn(),
      },
    });
  });

  it('places saved notes on the left and the full composer on the right', async () => {
    vi.mocked(window.desktop.getAllNotes).mockResolvedValueOnce([]);
    render(<TodayPage />);

    expect(await screen.findByRole('region', { name: '今日已保存记录' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '记录输入区' })).toBeInTheDocument();
    expect(screen.getByText('今天还没有记录')).toBeInTheDocument();
    expect(screen.queryByText('专注记录当天的学习心得与看盘经验。')).not.toBeInTheDocument();
  });

  it('creates a full note from the home composer and refreshes today records', async () => {
    const user = userEvent.setup();
    vi.mocked(window.desktop.getAllNotes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'note-new',
        title: null,
        content: '首页也能完整记录',
        categoryId: 'category-1',
        tagIds: ['tag-1', 'tag-2'],
        stockName: '贵州茅台',
        stockCode: '600519',
        attachmentIds: [],
        createdAt: todayAt1630(),
        updatedAt: todayAt1630(),
      }]);

    render(<TodayPage />);
    await screen.findByText('今天还没有记录');

    await user.type(screen.getByLabelText('笔记内容'), '首页也能完整记录');
    await user.selectOptions(screen.getByLabelText('分类选择'), 'category-1');
    await user.click(screen.getByRole('button', { name: '标签 突破' }));
    await user.type(screen.getByLabelText('新标签'), ' 放量 ');
    await user.click(screen.getByRole('button', { name: '添加标签' }));
    await user.type(screen.getByLabelText('股票名称'), '贵州茅台');
    await user.type(screen.getByLabelText('股票代码'), '600519');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(window.desktop.createTag).toHaveBeenCalledWith({ name: '放量' });
    expect(window.desktop.createNote).toHaveBeenCalledWith(expect.objectContaining({
      content: '首页也能完整记录',
      categoryId: 'category-1',
      tagIds: ['tag-1', 'tag-2'],
      stockName: '贵州茅台',
      stockCode: '600519',
    }));
    expect(await screen.findByText('首页也能完整记录')).toBeInTheDocument();
  });

  it('saves image drafts from the home composer without losing typed text', async () => {
    const user = userEvent.setup();
    const image = new File([Uint8Array.from([7, 8, 9])], 'chart.webp', { type: 'image/webp' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:chart');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.mocked(window.desktop.getAllNotes).mockResolvedValue([]);

    render(<TodayPage />);
    await screen.findByText('今天还没有记录');
    await user.type(screen.getByLabelText('笔记内容'), '图文一起保存');
    fireEvent.drop(screen.getByTestId('image-drop-zone'), {
      dataTransfer: { files: [image] },
    });
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(window.desktop.createNote).toHaveBeenCalledWith(expect.objectContaining({
      content: '图文一起保存',
      images: [expect.objectContaining({
        name: 'chart.webp',
        type: 'image/webp',
        bytes: Uint8Array.from([7, 8, 9]),
      })],
    }));
  });

  it('shows tags and stock details while omitting empty metadata areas', async () => {
    vi.mocked(window.desktop.getAllNotes).mockResolvedValueOnce([{
      id: 'note-meta', title: '个股观察', content: '观察承接', categoryId: 'category-1',
      tagIds: ['tag-1'], stockName: '贵州茅台', stockCode: '600519', attachmentIds: [],
      createdAt: todayAt1630(), updatedAt: todayAt1630(),
    }]);
    render(<TodayPage />);
    const savedRecords = await screen.findByRole('region', { name: '今日已保存记录' });
    expect(within(savedRecords).getByText('突破')).toBeInTheDocument();
    expect(within(savedRecords).getByText('贵州茅台 · 600519')).toBeInTheDocument();
  });

  it('shows saved note time, content summary, and category name', async () => {
    render(<TodayPage />);

    const savedRecords = await screen.findByRole('region', { name: '今日已保存记录' });
    expect(within(savedRecords).getByText('突破后回踩时需要观察成交量是否同步缩小。')).toBeInTheDocument();
    expect(within(savedRecords).getByText('K线知识')).toBeInTheDocument();
    expect(within(savedRecords).getByText(/16:30/)).toBeInTheDocument();
  });

  it('shows only notes created on the current local calendar day', async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30).toISOString();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 30).toISOString();
    vi.mocked(window.desktop.getAllNotes).mockResolvedValueOnce([
      {
        id: 'note-today', title: '今天', content: '今天的记录', categoryId: null,
        tagIds: [], stockName: null, stockCode: null, attachmentIds: [],
        createdAt: today, updatedAt: today,
      },
      {
        id: 'note-yesterday', title: '昨天', content: '昨天的记录', categoryId: null,
        tagIds: [], stockName: null, stockCode: null, attachmentIds: [],
        createdAt: yesterday, updatedAt: yesterday,
      },
    ]);

    render(<TodayPage />);

    expect(await screen.findByText('今天的记录')).toBeInTheDocument();
    expect(screen.queryByText('昨天的记录')).not.toBeInTheDocument();
  });

  it('shows a friendly read error without crashing', async () => {
    vi.mocked(window.desktop.getAllNotes).mockRejectedValueOnce(new Error('corrupt'));
    render(<TodayPage />);

    expect(await screen.findByText('读取本地笔记失败，请检查数据文件。')).toBeInTheDocument();
  });

  it('shows up to three thumbnails, an overflow count, and a closable preview', async () => {
    const user = userEvent.setup();
    vi.mocked(window.desktop.getAllNotes).mockResolvedValueOnce([{
      id: 'note-images', title: '图文记录', content: '观察量价关系', categoryId: 'category-1',
      tagIds: [], stockName: null, stockCode: null,
      attachmentIds: ['a1', 'a2', 'a3', 'a4'],
      createdAt: todayAt1630(), updatedAt: todayAt1630(),
    }]);
    vi.mocked(window.desktop.getAttachments).mockResolvedValueOnce(
      ['a1', 'a2', 'a3', 'a4'].map((id) => ({
        id, noteId: 'note-images', type: 'image/png', fileName: `${id}.png`,
        filePath: `C:\\attachments\\${id}.png`, createdAt: todayAt1630(),
      })),
    );
    vi.mocked(window.desktop.readAttachment).mockImplementation(async (id) => ({
      id, type: 'image/png', bytes: Uint8Array.from([1, 2, 3]),
    }));
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => (
      `blob:${value instanceof Blob ? value.size : 0}`
    ));
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    render(<TodayPage />);

    expect(await screen.findAllByRole('img', { name: /笔记附件/ })).toHaveLength(3);
    expect(screen.getByText('+1')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /查看图片/ })[0]);
    expect(screen.getByRole('dialog', { name: '图片预览' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '关闭图片预览' }));
    expect(screen.queryByRole('dialog', { name: '图片预览' })).not.toBeInTheDocument();
  });

  it('shows a missing-file placeholder instead of crashing', async () => {
    vi.mocked(window.desktop.getAllNotes).mockResolvedValueOnce([{
      id: 'note-images', title: '图文记录', content: '图片已丢失', categoryId: null,
      tagIds: [], stockName: null, stockCode: null, attachmentIds: ['missing'],
      createdAt: todayAt1630(), updatedAt: todayAt1630(),
    }]);
    vi.mocked(window.desktop.getAttachments).mockResolvedValueOnce([{
      id: 'missing', noteId: 'note-images', type: 'image/png', fileName: 'missing.png',
      filePath: 'C:\\attachments\\missing.png', createdAt: todayAt1630(),
    }]);
    vi.mocked(window.desktop.readAttachment).mockRejectedValueOnce(new Error('ENOENT'));

    render(<TodayPage />);

    expect(await screen.findByText('图片不可用')).toBeInTheDocument();
  });
});
