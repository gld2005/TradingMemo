import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { FloatingWindow } from './FloatingWindow';

describe('main window shell', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'desktop', {
      configurable: true,
      value: {
        setTitleBarTheme: vi.fn().mockResolvedValue(true),
        createNote: vi.fn().mockResolvedValue({ id: 'note-1' }),
        getAllNotes: vi.fn().mockResolvedValue([]),
        getAttachments: vi.fn().mockResolvedValue([]),
        getCategories: vi.fn().mockResolvedValue([
          { id: 'category-1', name: 'K线知识', sortOrder: 0 },
          { id: 'category-2', name: '交易经验', sortOrder: 1 },
        ]),
        createCategory: vi.fn(), updateCategory: vi.fn(), deleteCategory: vi.fn(),
        getTags: vi.fn().mockResolvedValue([]),
        createTag: vi.fn(), updateTag: vi.fn(), deleteTag: vi.fn(),
        getFloatingState: vi.fn().mockResolvedValue({ shortcutRegistered: true, visible: true }),
        getStorageInfo: vi.fn().mockResolvedValue({ dataFilePath: 'C:\\data\\notes.json' }),
        hideFloatingWindow: vi.fn().mockResolvedValue({ shortcutRegistered: true, visible: false }),
        onFloatingStateChanged: vi.fn().mockReturnValue(() => undefined),
        onFloatingShown: vi.fn().mockReturnValue(() => undefined),
        onNotesChanged: vi.fn().mockReturnValue(() => undefined),
        readAttachment: vi.fn(),
        setFloatingMode: vi.fn().mockResolvedValue(undefined),
        showFloatingWindow: vi.fn().mockResolvedValue({ shortcutRegistered: true, visible: true }),
        toggleFloatingWindow: vi.fn().mockResolvedValue({ shortcutRegistered: true, visible: false }),
      },
    });
  });

  it('renders an integrated draggable title bar surface', () => {
    render(<App />);

    expect(screen.getByTestId('app-title-bar')).toBeInTheDocument();
  });

  it('shows the requested page content when navigating', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('今天还没有记录，后续可以通过浮窗快速保存学习笔记。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '知识库' }));
    expect(await screen.findByText('知识库里还没有笔记。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '分类' }));
    expect(await screen.findByRole('heading', { name: '分类管理' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '标签管理' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '设置' }));
    expect(screen.getByText('数据管理')).toBeInTheDocument();
  });

  it('switches theme only in the current renderer state', async () => {
    const user = userEvent.setup();
    render(<App />);

    const shell = screen.getByTestId('app-shell');
    expect(shell).toHaveAttribute('data-theme', 'light');

    await user.click(screen.getByRole('button', { name: '切换到深色主题' }));
    expect(shell).toHaveAttribute('data-theme', 'dark');
    await waitFor(() => expect(window.desktop.setTitleBarTheme).toHaveBeenLastCalledWith('dark'));
  });

  it('tracks system theme changes while the system preference is selected', async () => {
    let settingsChanged: ((settings: AppSettings) => void) | undefined;
    let mediaChanged: (() => void) | undefined;
    const media = {
      matches: false,
      addEventListener: vi.fn((_name: string, callback: () => void) => { mediaChanged = callback; }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    Object.assign(window.desktop, {
      getSettings: vi.fn().mockResolvedValue({schemaVersion:1,theme:'system',floatingShortcut:'Alt+J',defaultCategoryId:null,onboardingDismissed:true}),
      onSettingsChanged: vi.fn((callback: (settings: AppSettings) => void) => { settingsChanged = callback; return () => undefined; }),
      updateSettings: vi.fn(),
    });
    render(<App />);

    const shell = screen.getByTestId('app-shell');
    await waitFor(() => expect(shell).toHaveAttribute('data-theme', 'light'));
    media.matches = true;
    act(() => mediaChanged?.());
    expect(shell).toHaveAttribute('data-theme', 'dark');

    act(() => settingsChanged?.({schemaVersion:1,theme:'light',floatingShortcut:'Alt+J',defaultCategoryId:null,onboardingDismissed:true}));
    expect(shell).toHaveAttribute('data-theme', 'light');
    vi.unstubAllGlobals();
  });

  it('provides a main-window entry that toggles the floating window', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '隐藏浮窗' }));

    expect(window.desktop.toggleFloatingWindow).toHaveBeenCalledOnce();
  });
});

describe('floating window placeholder', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'desktop', {
      configurable: true,
      value: {
        createNote: vi.fn().mockResolvedValue({ id: 'note-1' }),
        getAllNotes: vi.fn().mockResolvedValue([]),
        getAttachments: vi.fn().mockResolvedValue([]),
        getCategories: vi.fn().mockResolvedValue([
          { id: 'category-1', name: 'K线知识', sortOrder: 0 },
          { id: 'category-2', name: '交易经验', sortOrder: 1 },
        ]),
        createCategory: vi.fn(), updateCategory: vi.fn(), deleteCategory: vi.fn(),
        getTags: vi.fn().mockResolvedValue([{ id: 'tag-1', name: '突破', usageCount: 0 }]),
        createTag: vi.fn().mockResolvedValue({ id: 'tag-2', name: '放量', usageCount: 0 }),
        updateTag: vi.fn(), deleteTag: vi.fn(),
        getFloatingState: vi.fn().mockResolvedValue({ shortcutRegistered: true, visible: true }),
        getStorageInfo: vi.fn().mockResolvedValue({ dataFilePath: 'C:\\data\\notes.json' }),
        hideFloatingWindow: vi.fn().mockResolvedValue({ shortcutRegistered: true, visible: false }),
        onFloatingStateChanged: vi.fn().mockReturnValue(() => undefined),
        onFloatingShown: vi.fn().mockReturnValue(() => undefined),
        onNotesChanged: vi.fn().mockReturnValue(() => undefined),
        readAttachment: vi.fn(),
        setFloatingMode: vi.fn().mockResolvedValue(undefined),
        getFloatingBounds: vi.fn().mockResolvedValue({ x: 40, y: 60, width: 80, height: 80 }),
        setFloatingPosition: vi.fn(),
        showFloatingWindow: vi.fn().mockResolvedValue({ shortcutRegistered: true, visible: true }),
        toggleFloatingWindow: vi.fn().mockResolvedValue({ shortcutRegistered: true, visible: false }),
      },
    });
  });

  it('saves plain text with the selected category and clears after success', async () => {
    const user = userEvent.setup();
    render(<FloatingWindow />);

    expect(screen.getByText('Quick Note')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('输入学习心得或看盘经验...');
    const save = screen.getByRole('button', { name: '保存' });
    expect(save).toBeDisabled();

    await user.type(input, '记录一个临时心得');
    expect(save).toBeEnabled();
    await screen.findByRole('option', { name: '交易经验' });
    await user.selectOptions(screen.getByLabelText('分类选择'), 'category-2');
    await user.click(save);

    expect(window.desktop.createNote).toHaveBeenCalledWith({
      content: '记录一个临时心得',
      categoryId: 'category-2',
      tagIds: [],
      stockName: '',
      stockCode: '',
    });
    expect(await screen.findByText('笔记已保存到本地。')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('saves selected and newly created tags with optional stock fields, then clears them', async () => {
    const user = userEvent.setup();
    render(<FloatingWindow />);
    await screen.findByRole('button', { name: '标签 突破' });
    await user.click(screen.getByRole('button', { name: '标签 突破' }));
    await user.type(screen.getByLabelText('新标签'), ' 放量 ');
    await user.click(screen.getByRole('button', { name: '添加标签' }));
    await user.type(screen.getByLabelText('股票名称'), '贵州茅台');
    await user.type(screen.getByLabelText('股票代码'), '600519');
    await user.type(screen.getByLabelText('笔记内容'), '观察承接');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(window.desktop.createTag).toHaveBeenCalledWith({ name: '放量' });
    expect(window.desktop.createNote).toHaveBeenCalledWith(expect.objectContaining({
      tagIds: ['tag-1', 'tag-2'], stockName: '贵州茅台', stockCode: '600519',
    }));
    expect(screen.getByLabelText('股票名称')).toHaveValue('');
    expect(screen.getByLabelText('股票代码')).toHaveValue('');
    expect(screen.getByRole('button', { name: '标签 突破' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('refreshes local categories and tags after an organization change broadcast', async () => {
    let notesChanged: (() => void) | undefined;
    vi.mocked(window.desktop.onNotesChanged).mockImplementation((callback) => {
      notesChanged = callback;
      return () => undefined;
    });
    const getCategories = vi.mocked(window.desktop.getCategories);
    const getTags = vi.mocked(window.desktop.getTags);
    render(<FloatingWindow />);
    await screen.findByRole('option', { name: 'K线知识' });

    getCategories.mockResolvedValueOnce([{
      id: 'category-3', name: '观察方法', color: null, sortOrder: 0,
      createdAt: '2026-06-21T08:00:00.000Z', updatedAt: '2026-06-21T08:00:00.000Z',
    }]);
    getTags.mockResolvedValueOnce([{
      id: 'tag-3', name: '缩量', usageCount: 0,
      createdAt: '2026-06-21T08:00:00.000Z', updatedAt: '2026-06-21T08:00:00.000Z',
    }]);
    notesChanged?.();

    expect(await screen.findByRole('option', { name: '观察方法' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '标签 缩量' })).toBeInTheDocument();
  });

  it('keeps the text and shows a friendly error when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(window.desktop.createNote).mockRejectedValueOnce(new Error('disk full'));
    render(<FloatingWindow />);

    const input = screen.getByPlaceholderText('输入学习心得或看盘经验...');
    await user.type(input, '不能丢失的内容');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('保存失败，请检查本地数据文件后重试。')).toBeInTheDocument();
    expect(input).toHaveValue('不能丢失的内容');
  });

  it('switches between expanded and mini modes', async () => {
    const user = userEvent.setup();
    render(<FloatingWindow />);

    await user.click(screen.getByRole('button', { name: '折叠浮窗' }));
    expect(screen.getByRole('button', { name: '展开笔记浮窗' })).toBeInTheDocument();
    expect(window.desktop.setFloatingMode).toHaveBeenCalledWith('mini');

    await user.dblClick(screen.getByRole('button', { name: '展开笔记浮窗' }));
    expect(screen.getByText('Quick Note')).toBeInTheDocument();
    expect(window.desktop.setFloatingMode).toHaveBeenCalledWith('expanded');
  });

  it('moves the mini window with the latest captured pointer position', async () => {
    const user = userEvent.setup();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    render(<FloatingWindow />);
    await user.click(screen.getByRole('button', { name: '折叠浮窗' }));

    const miniButton = screen.getByRole('button', { name: '展开笔记浮窗' });
    Object.assign(miniButton, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn().mockReturnValue(true),
    });

    fireEvent.pointerDown(miniButton, { button: 0, pointerId: 7, screenX: 100, screenY: 120 });
    await waitFor(() => expect(window.desktop.getFloatingBounds).toHaveBeenCalledOnce());
    fireEvent.pointerMove(miniButton, { pointerId: 7, screenX: 135, screenY: 165 });
    fireEvent.pointerUp(miniButton, { pointerId: 7, screenX: 135, screenY: 165 });

    expect(miniButton.setPointerCapture).toHaveBeenCalledWith(7);
    expect(window.desktop.setFloatingPosition).toHaveBeenLastCalledWith(75, 105, 135, 165, true);
    vi.unstubAllGlobals();
  });

  it('uses pointer movement that happens while native bounds are loading', async () => {
    const user = userEvent.setup();
    let resolveBounds!: (bounds: { x: number; y: number; width: number; height: number }) => void;
    vi.mocked(window.desktop.getFloatingBounds!).mockReturnValueOnce(new Promise((resolve) => {
      resolveBounds = resolve;
    }));
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    render(<FloatingWindow />);
    await user.click(screen.getByRole('button', { name: '折叠浮窗' }));
    const miniButton = screen.getByRole('button', { name: '展开笔记浮窗' });
    Object.assign(miniButton, { setPointerCapture: vi.fn() });

    fireEvent.pointerDown(miniButton, { button: 0, pointerId: 4, screenX: 100, screenY: 120 });
    fireEvent.pointerMove(miniButton, { pointerId: 4, screenX: 130, screenY: 150 });
    frames.shift()?.(0);
    await act(async () => resolveBounds({ x: 40, y: 60, width: 80, height: 80 }));
    frames.shift()?.(1);

    expect(window.desktop.setFloatingPosition).toHaveBeenLastCalledWith(70, 90, 130, 150, false);
    vi.unstubAllGlobals();
  });

  it('keeps the expanded view when the native window cannot enter mini mode', async () => {
    const user = userEvent.setup();
    vi.mocked(window.desktop.setFloatingMode).mockRejectedValueOnce(new Error('resize failed'));
    render(<FloatingWindow />);

    await user.click(screen.getByRole('button', { name: '折叠浮窗' }));

    expect(screen.getByText('Quick Note')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '展开笔记浮窗' })).not.toBeInTheDocument();
  });

  it('adds pasted images as removable drafts without clearing typed text', async () => {
    const user = userEvent.setup();
    const image = new File([Uint8Array.from([1, 2, 3])], 'capture.png', { type: 'image/png' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:draft');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    render(<FloatingWindow />);

    const input = screen.getByPlaceholderText('输入学习心得或看盘经验...');
    await user.type(input, '文字仍然保留');
    fireEvent.paste(input, {
      clipboardData: { items: [{ kind: 'file', getAsFile: () => image }] },
    });

    expect(await screen.findByRole('img', { name: '草稿图片 capture.png' })).toHaveAttribute(
      'src', 'blob:draft',
    );
    expect(input).toHaveValue('文字仍然保留');
    await user.click(screen.getByRole('button', { name: '移除草稿图片 capture.png' }));
    expect(screen.queryByRole('img', { name: '草稿图片 capture.png' })).not.toBeInTheDocument();
  });

  it('saves an image-only draft and clears it only after success', async () => {
    const user = userEvent.setup();
    const image = new File([Uint8Array.from([7, 8, 9])], 'chart.webp', { type: 'image/webp' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:chart');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    render(<FloatingWindow />);

    fireEvent.drop(screen.getByTestId('image-drop-zone'), {
      dataTransfer: { files: [image] },
    });
    expect(await screen.findByRole('img', { name: '草稿图片 chart.webp' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(window.desktop.createNote).toHaveBeenCalledWith(expect.objectContaining({
      content: '',
      images: [expect.objectContaining({ name: 'chart.webp', type: 'image/webp' })],
    })));
    const submitted = vi.mocked(window.desktop.createNote).mock.calls[0][0].images?.[0];
    expect(Array.from(submitted?.bytes ?? [])).toEqual([7, 8, 9]);
    expect(await screen.findByText('笔记已保存到本地。')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '草稿图片 chart.webp' })).not.toBeInTheDocument();
  });

  it('shows a format message when a non-image file is dropped', async () => {
    render(<FloatingWindow />);
    fireEvent.drop(screen.getByTestId('image-drop-zone'), {
      dataTransfer: { files: [new File(['text'], 'note.txt', { type: 'text/plain' })] },
    });

    expect(await screen.findByText('仅支持 PNG、JPG、JPEG 和 WebP 图片。')).toBeInTheDocument();
  });

  it('saves typed text and image bytes together', async () => {
    const user = userEvent.setup();
    const image = new File([Uint8Array.from([4, 5, 6])], 'combo.png', { type: 'image/png' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:combo');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    render(<FloatingWindow />);

    await user.type(screen.getByLabelText('笔记内容'), '图文一起保存');
    fireEvent.drop(screen.getByTestId('image-drop-zone'), {
      dataTransfer: { files: [image] },
    });
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(window.desktop.createNote).toHaveBeenCalledWith(expect.objectContaining({
      content: '图文一起保存',
      images: [expect.objectContaining({
        name: 'combo.png',
        type: 'image/png',
        bytes: Uint8Array.from([4, 5, 6]),
      })],
    }));
  });

  it('keeps image drafts available when saving fails', async () => {
    const user = userEvent.setup();
    const image = new File([Uint8Array.from([1])], 'keep.png', { type: 'image/png' });
    vi.mocked(window.desktop.createNote).mockRejectedValueOnce(new Error('disk full'));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:keep');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    render(<FloatingWindow />);

    fireEvent.drop(screen.getByTestId('image-drop-zone'), {
      dataTransfer: { files: [image] },
    });
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('保存失败，请检查本地数据文件后重试。')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '草稿图片 keep.png' })).toBeInTheDocument();
  });
});
