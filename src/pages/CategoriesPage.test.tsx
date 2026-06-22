import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoriesPage } from './CategoriesPage';

describe('category and tag management', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'desktop', { configurable: true, value: {
      getAllNotes: vi.fn().mockResolvedValue([{ id: 'n1', categoryId: 'c1', tagIds: ['t1'] }]),
      getCategories: vi.fn().mockResolvedValue([{ id: 'c1', name: 'K线知识', color: null, sortOrder: 0 }]),
      getTags: vi.fn().mockResolvedValue([{ id: 't1', name: '突破', usageCount: 1 }]),
      createCategory: vi.fn().mockResolvedValue({ id: 'c2', name: '观察方法', color: null, sortOrder: 1 }),
      updateCategory: vi.fn().mockResolvedValue({ id: 'c1', name: '走势知识', color: null, sortOrder: 0 }),
      deleteCategory: vi.fn().mockResolvedValue(undefined),
      createTag: vi.fn().mockResolvedValue({ id: 't2', name: '放量', usageCount: 0 }),
      updateTag: vi.fn().mockResolvedValue({ id: 't1', name: '有效突破', usageCount: 1 }),
      deleteTag: vi.fn().mockResolvedValue(undefined),
      onNotesChanged: vi.fn().mockReturnValue(() => undefined),
    }});
  });

  it('shows category note counts and tag usage counts', async () => {
    render(<CategoriesPage />);
    expect(await screen.findByText('K线知识')).toBeInTheDocument();
    expect(screen.getByText('1 条笔记')).toBeInTheDocument();
    expect(screen.getByText('使用 1 次')).toBeInTheDocument();
  });

  it('creates a trimmed category and shows repository errors', async () => {
    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByText('K线知识');
    await user.type(screen.getByLabelText('新分类名称'), ' 观察方法 ');
    await user.click(screen.getByRole('button', { name: '新增分类' }));
    expect(window.desktop.createCategory).toHaveBeenCalledWith({ name: '观察方法' });

    vi.mocked(window.desktop.createCategory).mockRejectedValueOnce(new Error('分类名称不能重复。'));
    await user.type(screen.getByLabelText('新分类名称'), 'K线知识');
    await user.click(screen.getByRole('button', { name: '新增分类' }));
    expect(await screen.findByText('分类名称不能重复。')).toBeInTheDocument();
  });

  it('confirms deletion and shows a used-item rejection', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(window.desktop.deleteTag).mockRejectedValueOnce(new Error('已有笔记使用该标签，不能删除。'));
    render(<CategoriesPage />);
    await screen.findByText('突破');
    await user.click(screen.getByRole('button', { name: '删除标签 突破' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText('已有笔记使用该标签，不能删除。')).toBeInTheDocument();
  });

  it('shows a validation message when a category edit is blank', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'prompt').mockReturnValue('   ');
    render(<CategoriesPage />);
    await screen.findByText('K线知识');
    await user.click(screen.getByRole('button', { name: '编辑分类 K线知识' }));
    expect(await screen.findByText('分类名称不能为空。')).toBeInTheDocument();
    expect(window.desktop.updateCategory).not.toHaveBeenCalled();
  });

  it('shows a validation message when a tag edit is blank', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'prompt').mockReturnValue('   ');
    render(<CategoriesPage />);
    await screen.findByText('突破');
    await user.click(screen.getByRole('button', { name: '编辑标签 突破' }));
    expect(await screen.findByText('标签名称不能为空。')).toBeInTheDocument();
    expect(window.desktop.updateTag).not.toHaveBeenCalled();
  });
});
