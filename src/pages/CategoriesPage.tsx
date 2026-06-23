import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PageHeader } from '../components/PageHeader';

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [tagName, setTagName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!window.desktop) return;
    setLoading(true);
    try {
      const [savedCategories, savedTags, savedNotes] = await Promise.all([
        window.desktop.getCategories(), window.desktop.getTags(), window.desktop.getAllNotes(),
      ]);
      setCategories(savedCategories);
      setTags(savedTags);
      setNotes(savedNotes);
      setFeedback('');
    } catch {
      setFeedback('读取分类和标签失败，请检查本地数据文件。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return window.desktop?.onNotesChanged(() => void load());
  }, [load]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach((note) => {
      if (note.categoryId) counts.set(note.categoryId, (counts.get(note.categoryId) || 0) + 1);
    });
    return counts;
  }, [notes]);

  function message(error: unknown) {
    setFeedback(error instanceof Error ? error.message : '本地数据操作失败，请重试。');
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return setFeedback('分类名称不能为空。');
    try {
      await window.desktop.createCategory({ name });
      setCategoryName('');
      await load();
    } catch (error) { message(error); }
  }

  async function addTag(event: FormEvent) {
    event.preventDefault();
    const name = tagName.trim();
    if (!name) return setFeedback('标签名称不能为空。');
    try {
      await window.desktop.createTag({ name });
      setTagName('');
      await load();
    } catch (error) { message(error); }
  }

  async function renameCategory(category: Category) {
    const answer = window.prompt('编辑分类名称', category.name);
    if (answer == null) return;
    const name = answer.trim();
    if (!name) return setFeedback('分类名称不能为空。');
    if (name === category.name) return;
    try { await window.desktop.updateCategory(category.id, { name }); await load(); } catch (error) { message(error); }
  }

  async function renameTag(tag: Tag) {
    const answer = window.prompt('编辑标签名称', tag.name);
    if (answer == null) return;
    const name = answer.trim();
    if (!name) return setFeedback('标签名称不能为空。');
    if (name === tag.name) return;
    try { await window.desktop.updateTag(tag.id, { name }); await load(); } catch (error) { message(error); }
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`确认删除分类“${category.name}”？`)) return;
    try { await window.desktop.deleteCategory(category.id); await load(); } catch (error) { message(error); }
  }

  async function removeTag(tag: Tag) {
    if (!window.confirm(`确认删除标签“${tag.name}”？`)) return;
    try { await window.desktop.deleteTag(tag.id); await load(); } catch (error) { message(error); }
  }

  return (
    <div className="page">
      <PageHeader title="分类" />
      {feedback ? <Card className="organizer-feedback" aria-live="polite">{feedback}</Card> : null}
      <div className="organizer-grid">
        <Card className="organizer-panel">
          <div className="organizer-panel__header"><div><h2>分类管理</h2><p>每条笔记最多关联一个分类。</p></div></div>
          <form className="organizer-form" onSubmit={(event) => void addCategory(event)}>
            <Input aria-label="新分类名称" onChange={(event) => setCategoryName(event.target.value)} placeholder="输入分类名称" value={categoryName} />
            <Button type="submit">新增分类</Button>
          </form>
          {loading ? <p className="organizer-empty">正在读取…</p> : null}
          {!loading && categories.length === 0 ? <p className="organizer-empty">还没有分类，可以从这里创建。</p> : null}
          <div className="organizer-list">
            {categories.map((category) => (
              <div className="organizer-item" key={category.id}>
                <div><strong>{category.name}</strong><span>{categoryCounts.get(category.id) || 0} 条笔记</span></div>
                <div className="organizer-item__actions">
                  <button aria-label={`编辑分类 ${category.name}`} onClick={() => void renameCategory(category)} type="button">编辑</button>
                  <button aria-label={`删除分类 ${category.name}`} onClick={() => void removeCategory(category)} type="button">删除</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="organizer-panel">
          <div className="organizer-panel__header"><div><h2>标签管理</h2><p>标签可用于补充笔记主题。</p></div></div>
          <form className="organizer-form" onSubmit={(event) => void addTag(event)}>
            <Input aria-label="新标签名称" onChange={(event) => setTagName(event.target.value)} placeholder="输入标签名称" value={tagName} />
            <Button type="submit">新增标签</Button>
          </form>
          {!loading && tags.length === 0 ? <p className="organizer-empty">还没有标签，可以从这里创建。</p> : null}
          <div className="organizer-list">
            {tags.map((tag) => (
              <div className="organizer-item" key={tag.id}>
                <div><strong>{tag.name}</strong><span>使用 {tag.usageCount} 次</span></div>
                <div className="organizer-item__actions">
                  <button aria-label={`编辑标签 ${tag.name}`} onClick={() => void renameTag(tag)} type="button">编辑</button>
                  <button aria-label={`删除标签 ${tag.name}`} onClick={() => void removeTag(tag)} type="button">删除</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
