import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryPage } from './LibraryPage';

const category = {
  id: 'category-1', name: 'K线知识', color: null, sortOrder: 0,
  createdAt: '2026-06-21T08:00:00.000Z', updatedAt: '2026-06-21T08:00:00.000Z',
};
const tag = {
  id: 'tag-1', name: '突破', usageCount: 1,
  createdAt: '2026-06-21T08:00:00.000Z', updatedAt: '2026-06-21T08:00:00.000Z',
};
const notes: Note[] = [
  {
    id: 'note-1', title: '放量突破观察', content: '突破之后观察承接力度。',
    categoryId: category.id, tagIds: [tag.id], stockName: '贵州茅台', stockCode: '600519',
    attachmentIds: ['attachment-1'], createdAt: '2026-06-21T08:00:00.000Z',
    updatedAt: '2026-06-21T09:00:00.000Z',
  },
  {
    id: 'note-2', title: null, content: '没有分类的复盘记录。', categoryId: null, tagIds: [],
    stockName: null, stockCode: null, attachmentIds: [],
    createdAt: '2026-06-20T08:00:00.000Z', updatedAt: '2026-06-20T08:00:00.000Z',
  },
];
const attachment: Attachment = {
  id: 'attachment-1', noteId: 'note-1', type: 'image/png', fileName: 'chart.png',
  filePath: 'C:\\attachments\\chart.png', createdAt: '2026-06-21T08:00:00.000Z',
};

function installDesktop(savedNotes: Note[] = notes) {
  Object.defineProperty(window, 'desktop', {
    configurable: true,
    value: {
      getAllNotes: vi.fn().mockResolvedValue(savedNotes),
      getCategories: vi.fn().mockResolvedValue([category]),
      getTags: vi.fn().mockResolvedValue([tag]),
      getAttachments: vi.fn().mockResolvedValue(savedNotes.some(({ attachmentIds }) => attachmentIds.length) ? [attachment] : []),
      readAttachment: vi.fn().mockResolvedValue({
        id: attachment.id, type: attachment.type, bytes: Uint8Array.from([1, 2, 3]),
      }),
      updateNote: vi.fn().mockResolvedValue({ note: savedNotes[0], warnings: [] }),
      deleteNote: vi.fn().mockResolvedValue({ note: savedNotes[0], warnings: [] }),
      onNotesChanged: vi.fn().mockReturnValue(() => undefined),
    },
  });
}

describe('knowledge library', () => {
  beforeEach(() => {
    installDesktop();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:attachment');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  it('loads local data into category, card list, and selected detail columns', async () => {
    const user = userEvent.setup();
    render(<LibraryPage />);

    expect(await screen.findByRole('heading', { name: '放量突破观察' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '知识库分类' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '笔记列表' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '笔记详情' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部笔记 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'K线知识 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未分类 1' })).toBeInTheDocument();
    expect(screen.getAllByText('贵州茅台 · 600519').length).toBeGreaterThan(0);
    expect(screen.getAllByText('突破').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '未分类 1' }));
    expect(screen.getByRole('heading', { name: '没有分类的复盘记录。' })).toBeInTheDocument();
    expect(screen.queryByText('放量突破观察')).not.toBeInTheDocument();
  });

  it('edits fields, tags, and attachments through the existing local bridge', async () => {
    const user = userEvent.setup();
    const newImage = new File([Uint8Array.from([7, 8])], 'new.webp', { type: 'image/webp' });
    render(<LibraryPage />);
    await screen.findByRole('heading', { name: '放量突破观察' });

    await user.click(screen.getByRole('button', { name: '编辑笔记' }));
    await user.clear(screen.getByLabelText('标题'));
    await user.type(screen.getByLabelText('标题'), '更新标题');
    await user.clear(screen.getByLabelText('正文'));
    await user.type(screen.getByLabelText('正文'), '更新正文');
    await user.click(screen.getByRole('button', { name: '标签 突破' }));
    await user.click(screen.getByRole('button', { name: '移除已有图片 chart.png' }));
    fireEvent.drop(screen.getByTestId('library-image-drop-zone'), {
      dataTransfer: { files: [newImage] },
    });
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => expect(window.desktop.updateNote).toHaveBeenCalledOnce());
    expect(window.desktop.updateNote).toHaveBeenCalledWith('note-1', expect.objectContaining({
      title: '更新标题', content: '更新正文', categoryId: 'category-1', tagIds: [],
      stockName: '贵州茅台', stockCode: '600519', removeAttachmentIds: ['attachment-1'],
      images: [expect.objectContaining({ name: 'new.webp', type: 'image/webp' })],
    }));
  });

  it('clears the detail when an edited note leaves the active category', async () => {
    const user = userEvent.setup();
    const movedNote = { ...notes[0], categoryId: null, updatedAt: '2026-06-21T10:00:00.000Z' };
    vi.mocked(window.desktop.getAllNotes)
      .mockResolvedValueOnce(notes)
      .mockResolvedValueOnce([movedNote, notes[1]]);
    render(<LibraryPage />);
    await screen.findByRole('heading', { name: '放量突破观察' });

    await user.click(screen.getByRole('button', { name: 'K线知识 1' }));
    await user.click(screen.getByRole('button', { name: '编辑笔记' }));
    await user.selectOptions(screen.getByLabelText('分类'), '');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(await screen.findByText('当前分类还没有笔记。')).toBeInTheDocument();
    expect(screen.getByText('选择一条笔记查看详情。')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '放量突破观察' })).not.toBeInTheDocument();
  });

  it('searches local note content and keeps the detail synchronized with results', async () => {
    const user = userEvent.setup();
    render(<LibraryPage />);
    const search = await screen.findByRole('searchbox', { name: '搜索笔记' });

    await user.type(search, '没有分类');

    expect(screen.getByText('1 条结果')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '没有分类的复盘记录。' })).toBeInTheDocument();
    expect(screen.queryByText('放量突破观察')).not.toBeInTheDocument();

    await user.clear(search);
    expect(screen.getByText('2 条结果')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '没有分类的复盘记录。' })).toBeInTheDocument();
  });

  it('combines visible filters and supports clearing one condition or all conditions', async () => {
    const user = userEvent.setup();
    render(<LibraryPage />);
    await screen.findByRole('heading', { name: '放量突破观察' });

    await user.click(screen.getByRole('button', { name: '筛选' }));
    await user.selectOptions(screen.getByLabelText('筛选分类'), category.id);
    await user.click(screen.getByRole('button', { name: '筛选标签 突破' }));
    await user.type(screen.getByLabelText('筛选股票'), '600519');
    await user.selectOptions(screen.getByLabelText('日期范围'), 'custom');
    await user.type(screen.getByLabelText('开始日期'), '2026-06-21');
    await user.type(screen.getByLabelText('结束日期'), '2026-06-21');
    await user.click(screen.getByRole('checkbox', { name: '只看带图片' }));

    expect(screen.getByText('1 条结果')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除分类筛选 K线知识' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移除标签筛选 突破' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除股票筛选 600519' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除图片筛选' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清除分类筛选 K线知识' }));
    expect(screen.queryByRole('button', { name: '清除分类筛选 K线知识' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清空全部条件' }));
    expect(screen.getByText('2 条结果')).toBeInTheDocument();
    expect(screen.getByLabelText('筛选分类')).toHaveValue('all');
    expect(screen.getByLabelText('筛选股票')).toHaveValue('');
  });

  it('shows a friendly empty state and validates custom date order', async () => {
    const user = userEvent.setup();
    render(<LibraryPage />);
    const search = await screen.findByRole('searchbox', { name: '搜索笔记' });

    await user.type(search, '不存在的内容');
    expect(screen.getByText('没有找到符合条件的笔记。')).toBeInTheDocument();
    expect(screen.getByText('选择一条笔记查看详情。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '清空筛选' }));

    await user.click(screen.getByRole('button', { name: '筛选' }));
    await user.selectOptions(screen.getByLabelText('日期范围'), 'custom');
    await user.type(screen.getByLabelText('开始日期'), '2026-06-22');
    await user.type(screen.getByLabelText('结束日期'), '2026-06-21');
    expect(screen.getByText('开始日期不能晚于结束日期。')).toBeInTheDocument();
  });

  it('requires confirmation, deletes locally, and selects the next remaining note', async () => {
    const user = userEvent.setup();
    installDesktop(notes);
    vi.mocked(window.desktop.getAllNotes)
      .mockResolvedValueOnce(notes)
      .mockResolvedValueOnce([notes[1]]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<LibraryPage />);
    await screen.findByRole('heading', { name: '放量突破观察' });

    await user.click(screen.getByRole('button', { name: '删除笔记' }));

    expect(window.confirm).toHaveBeenCalledWith('确定删除这条笔记吗？相关图片附件也会一并移除。');
    expect(window.desktop.deleteNote).toHaveBeenCalledWith('note-1');
    expect(await screen.findByRole('heading', { name: '没有分类的复盘记录。' })).toBeInTheDocument();
  });

  it('shows stable empty and read-error states', async () => {
    installDesktop([]);
    const { rerender } = render(<LibraryPage />);
    expect(await screen.findByText('知识库里还没有笔记。')).toBeInTheDocument();

    vi.mocked(window.desktop.getAllNotes).mockRejectedValueOnce(new Error('broken file'));
    rerender(<LibraryPage key="error" />);
    expect(await screen.findByText('读取本地知识库失败，请检查数据文件。')).toBeInTheDocument();
  });
});
