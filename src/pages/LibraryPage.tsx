import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { PageHeader } from '../components/PageHeader';
import { readFileBytes, selectImageDrafts } from '../app/image-drafts';
import {
  createDefaultLibraryFilters,
  filterLibraryNotes,
  type LibraryCategoryFilter,
  type LibraryDatePreset,
  type LibraryFilters,
  validateDateRange,
} from './library-filters';

type ImagePreview = { url: string; label: string };
type NewImageDraft = { file: File; url: string };

function noteTitle(note: Note) {
  return note.title?.trim() || note.content.trim() || '图片笔记';
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

function AttachmentImage({
  attachment,
  compact = false,
  onOpen,
}: {
  attachment: Attachment;
  compact?: boolean;
  onOpen: (preview: ImagePreview) => void;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [url, setUrl] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    void window.desktop.readAttachment(attachment.id).then((content) => {
      if (!active) return;
      const bytes = Uint8Array.from(content.bytes);
      objectUrl = URL.createObjectURL(new Blob([bytes.buffer], { type: content.type }));
      setUrl(objectUrl);
      setStatus('ready');
    }).catch(() => {
      if (active) setStatus('missing');
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  if (status === 'loading') return <span className="library-image-state">读取中</span>;
  if (status === 'missing') return <span className="library-image-state">图片不可用</span>;
  if (compact) return <span className="library-card__image"><img alt={`笔记附件 ${attachment.fileName}`} src={url} /></span>;
  return (
    <button
      aria-label={`查看图片 ${attachment.fileName}`}
      className={compact ? 'library-card__image' : 'library-detail__image'}
      onClick={() => onOpen({ url, label: attachment.fileName })}
      type="button"
    >
      <img alt={`笔记附件 ${attachment.fileName}`} src={url} />
    </button>
  );
}

type EditorState = {
  title: string;
  content: string;
  categoryId: string;
  tagIds: string[];
  stockName: string;
  stockCode: string;
  removedAttachmentIds: string[];
  newImages: NewImageDraft[];
};

function createEditorState(note: Note): EditorState {
  return {
    title: note.title ?? '', content: note.content, categoryId: note.categoryId ?? '',
    tagIds: [...note.tagIds], stockName: note.stockName ?? '', stockCode: note.stockCode ?? '',
    removedAttachmentIds: [], newImages: [],
  };
}

export function LibraryPage() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [filters, setFilters] = useState<LibraryFilters>(createDefaultLibraryFilters);
  const filtersRef = useRef<LibraryFilters>(filters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(Boolean(window.desktop));
  const [notes, setNotes] = useState<Note[]>([]);
  const [preview, setPreview] = useState<ImagePreview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);

  const loadLibrary = useCallback(async (preferredId?: string | null) => {
    if (!window.desktop) return;
    setLoading(true);
    setError('');
    try {
      const [savedNotes, savedCategories, savedTags] = await Promise.all([
        window.desktop.getAllNotes(), window.desktop.getCategories(), window.desktop.getTags(),
      ]);
      const attachmentIds = savedNotes.flatMap((note) => note.attachmentIds);
      const savedAttachments = attachmentIds.length > 0
        ? await window.desktop.getAttachments(attachmentIds)
        : [];
      setNotes(savedNotes);
      setCategories(savedCategories);
      setTags(savedTags);
      setAttachments(savedAttachments);
      const visibleSavedNotes = filterLibraryNotes(
        savedNotes, savedCategories, savedTags, filtersRef.current,
      );
      setSelectedId((current) => {
        const requested = preferredId === undefined ? current : preferredId;
        return visibleSavedNotes.some(({ id }) => id === requested)
          ? requested
          : visibleSavedNotes[0]?.id ?? null;
      });
    } catch {
      setError('读取本地知识库失败，请检查数据文件。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
    if (!window.desktop) return;
    return window.desktop.onNotesChanged(() => void loadLibrary());
  }, [loadLibrary]);

  const categoryNames = useMemo(
    () => new Map(categories.map(({ id, name }) => [id, name])),
    [categories],
  );
  const tagNames = useMemo(() => new Map(tags.map(({ id, name }) => [id, name])), [tags]);
  const attachmentsById = useMemo(
    () => new Map(attachments.map((item) => [item.id, item])),
    [attachments],
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach(({ categoryId }) => {
      if (categoryId) counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    });
    return counts;
  }, [notes]);
  const visibleNotes = useMemo(
    () => filterLibraryNotes(notes, categories, tags, filters),
    [notes, categories, tags, filters],
  );
  const selectedNote = visibleNotes.find(({ id }) => id === selectedId) ?? null;
  const dateError = filters.datePreset === 'custom'
    ? validateDateRange(filters.dateStart, filters.dateEnd)
    : '';
  const hasAnyCondition = Boolean(
    filters.query.trim() || filters.category !== 'all' || filters.tagIds.length
    || filters.stockQuery.trim() || filters.datePreset !== 'all' || filters.hasImages,
  );
  const hasSearchOrAdvancedFilter = Boolean(
    filters.query.trim() || filters.tagIds.length || filters.stockQuery.trim()
    || filters.datePreset !== 'all' || filters.hasImages,
  );
  const selectedCategoryName = filters.category === 'uncategorized'
    ? '未分类'
    : categoryNames.get(filters.category);
  const datePresetNames: Record<LibraryDatePreset, string> = {
    all: '全部日期', today: '今天', week: '本周', month: '本月', custom: '自定义日期',
  };
  const activeFilterCount = Number(filters.category !== 'all') + filters.tagIds.length
    + Number(Boolean(filters.stockQuery.trim())) + Number(filters.datePreset !== 'all')
    + Number(filters.hasImages);

  useEffect(() => {
    if (visibleNotes.some(({ id }) => id === selectedId)) return;
    setEditor((current) => {
      current?.newImages.forEach(({ url }) => URL.revokeObjectURL(url));
      return null;
    });
    setSelectedId(visibleNotes[0]?.id ?? null);
  }, [selectedId, visibleNotes]);

  function updateFilters(patch: Partial<LibraryFilters>) {
    setFilters((current) => {
      const next = { ...current, ...patch };
      filtersRef.current = next;
      return next;
    });
  }

  function clearAllFilters() {
    const next = createDefaultLibraryFilters();
    filtersRef.current = next;
    setFilters(next);
  }

  function chooseScope(nextScope: LibraryCategoryFilter) {
    editor?.newImages.forEach(({ url }) => URL.revokeObjectURL(url));
    updateFilters({ category: nextScope });
    setEditor(null);
    const nextNotes = filterLibraryNotes(
      notes, categories, tags, { ...filtersRef.current, category: nextScope },
    );
    setSelectedId(nextNotes[0]?.id ?? null);
  }

  function cancelEdit() {
    editor?.newImages.forEach(({ url }) => URL.revokeObjectURL(url));
    setEditor(null);
  }

  function addImageDrafts(files: Iterable<File>) {
    if (!editor || !selectedNote) return;
    const retainedCount = selectedNote.attachmentIds.length - editor.removedAttachmentIds.length;
    const selection = selectImageDrafts(files, retainedCount + editor.newImages.length);
    const nextImages = selection.accepted.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setEditor({ ...editor, newImages: [...editor.newImages, ...nextImages] });
    setFeedback(selection.message);
  }

  async function saveEdit() {
    if (!editor || !selectedNote) return;
    setFeedback('');
    try {
      const images = await Promise.all(editor.newImages.map(async ({ file }) => ({
        name: file.name, type: file.type, bytes: await readFileBytes(file),
      })));
      const result = await window.desktop.updateNote(selectedNote.id, {
        title: editor.title, content: editor.content, categoryId: editor.categoryId || null,
        tagIds: editor.tagIds, stockName: editor.stockName, stockCode: editor.stockCode,
        removeAttachmentIds: editor.removedAttachmentIds, images,
      });
      editor.newImages.forEach(({ url }) => URL.revokeObjectURL(url));
      setEditor(null);
      setFeedback(result.warnings[0] ?? '笔记修改已保存。');
      await loadLibrary(selectedNote.id);
    } catch {
      setFeedback('保存修改失败，请检查本地数据文件后重试。');
    }
  }

  async function deleteSelectedNote() {
    if (!selectedNote || !window.confirm('确定删除这条笔记吗？相关图片附件也会一并移除。')) return;
    setFeedback('');
    try {
      const result = await window.desktop.deleteNote(selectedNote.id);
      setEditor(null);
      setFeedback(result.warnings[0] ?? '笔记已删除。');
      await loadLibrary(null);
    } catch {
      setFeedback('删除笔记失败，请检查本地数据文件后重试。');
    }
  }

  return (
    <div className="page library-page">
      <PageHeader title="知识库" description="集中查看并整理积累下来的学习内容。" />
      {feedback ? <div className="library-feedback" role="status">{feedback}</div> : null}
      {error ? <Card className="notes-status notes-status--error">{error}</Card> : null}
      {!error && loading ? <Card className="notes-status">正在读取本地知识库…</Card> : null}
      {!error && !loading && notes.length === 0 ? <EmptyState message="知识库里还没有笔记。" /> : null}
      {!error && !loading && notes.length > 0 ? (
        <div className="library-layout">
          <nav aria-label="知识库分类" className="library-categories">
            <div className="library-column-title">分类浏览</div>
            <button aria-label={`全部笔记 ${notes.length}`} aria-pressed={filters.category === 'all'} onClick={() => chooseScope('all')} type="button">
              <span>全部笔记</span><strong>{notes.length}</strong>
            </button>
            <button aria-label={`未分类 ${notes.filter(({ categoryId }) => !categoryId).length}`} aria-pressed={filters.category === 'uncategorized'} onClick={() => chooseScope('uncategorized')} type="button">
              <span>未分类</span><strong>{notes.filter(({ categoryId }) => !categoryId).length}</strong>
            </button>
            <div className="library-categories__divider" />
            {categories.map((item) => (
              <button aria-label={`${item.name} ${categoryCounts.get(item.id) ?? 0}`} aria-pressed={filters.category === item.id} key={item.id} onClick={() => chooseScope(item.id)} type="button">
                <span>{item.name}</span><strong>{categoryCounts.get(item.id) ?? 0}</strong>
              </button>
            ))}
          </nav>

          <section className="library-list-panel">
            <div className="library-search-row">
              <input
                aria-label="搜索笔记"
                className="library-search-input"
                onChange={(event) => updateFilters({ query: event.target.value })}
                placeholder="搜索标题、正文、股票、标签..."
                type="search"
                value={filters.query}
              />
              <button
                aria-expanded={filtersOpen}
                aria-label="筛选"
                className="library-filter-toggle"
                onClick={() => setFiltersOpen((open) => !open)}
                type="button"
              >
                筛选{activeFilterCount > 0 ? <span aria-hidden="true">{activeFilterCount}</span> : null}
              </button>
            </div>

            {filtersOpen ? (
              <div aria-label="笔记筛选" className="library-filter-panel">
                <label><span>分类</span><select aria-label="筛选分类" onChange={(event) => chooseScope(event.target.value)} value={filters.category}><option value="all">全部分类</option><option value="uncategorized">未分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label><span>股票</span><input aria-label="筛选股票" onChange={(event) => updateFilters({ stockQuery: event.target.value })} placeholder="名称或代码" value={filters.stockQuery} /></label>
                <label><span>日期</span><select aria-label="日期范围" onChange={(event) => updateFilters({ datePreset: event.target.value as LibraryDatePreset })} value={filters.datePreset}><option value="all">全部</option><option value="today">今天</option><option value="week">本周</option><option value="month">本月</option><option value="custom">自定义</option></select></label>
                {filters.datePreset === 'custom' ? <div className="library-date-range"><label><span>开始</span><input aria-label="开始日期" onChange={(event) => updateFilters({ dateStart: event.target.value })} type="date" value={filters.dateStart} /></label><label><span>结束</span><input aria-label="结束日期" onChange={(event) => updateFilters({ dateEnd: event.target.value })} type="date" value={filters.dateEnd} /></label></div> : null}
                {dateError ? <p className="library-filter-error" role="alert">{dateError}</p> : null}
                <label className="library-image-filter"><input aria-label="只看带图片" checked={filters.hasImages} onChange={(event) => updateFilters({ hasImages: event.target.checked })} type="checkbox" /><span>只看带图片</span></label>
                {tags.length > 0 ? <div className="library-filter-tags"><span>标签（多选为 AND）</span><div>{tags.map((item) => <button aria-label={`筛选标签 ${item.name}`} aria-pressed={filters.tagIds.includes(item.id)} key={item.id} onClick={() => updateFilters({ tagIds: filters.tagIds.includes(item.id) ? filters.tagIds.filter((id) => id !== item.id) : [...filters.tagIds, item.id] })} type="button">{item.name}</button>)}</div></div> : null}
              </div>
            ) : null}

            {hasAnyCondition ? <div className="library-active-filters">
              {filters.query.trim() ? <button aria-label={`清除搜索条件 ${filters.query.trim()}`} onClick={() => updateFilters({ query: '' })} type="button">搜索：{filters.query.trim()} ×</button> : null}
              {filters.category !== 'all' ? <button aria-label={`清除分类筛选 ${selectedCategoryName ?? '未知分类'}`} onClick={() => chooseScope('all')} type="button">分类：{selectedCategoryName ?? '未知分类'} ×</button> : null}
              {filters.tagIds.map((id) => <button aria-label={`移除标签筛选 ${tagNames.get(id) ?? id}`} key={id} onClick={() => updateFilters({ tagIds: filters.tagIds.filter((tagId) => tagId !== id) })} type="button">标签：{tagNames.get(id) ?? id} ×</button>)}
              {filters.stockQuery.trim() ? <button aria-label={`清除股票筛选 ${filters.stockQuery.trim()}`} onClick={() => updateFilters({ stockQuery: '' })} type="button">股票：{filters.stockQuery.trim()} ×</button> : null}
              {filters.datePreset !== 'all' ? <button aria-label={`清除日期筛选 ${datePresetNames[filters.datePreset]}`} onClick={() => updateFilters({ datePreset: 'all', dateStart: '', dateEnd: '' })} type="button">日期：{datePresetNames[filters.datePreset]} ×</button> : null}
              {filters.hasImages ? <button aria-label="清除图片筛选" onClick={() => updateFilters({ hasImages: false })} type="button">带图片 ×</button> : null}
            </div> : null}

            <div className="library-result-summary"><span>{visibleNotes.length} 条结果</span>{hasAnyCondition ? <button aria-label="清空全部条件" onClick={clearAllFilters} type="button">清空全部</button> : null}</div>
            {visibleNotes.length === 0 ? <div className="library-panel-empty library-results-empty"><p>{hasSearchOrAdvancedFilter ? '没有找到符合条件的笔记。' : '当前分类还没有笔记。'}</p>{hasAnyCondition ? <button aria-label="清空筛选" onClick={clearAllFilters} type="button">清空筛选</button> : null}</div> : (
              <div aria-label="笔记列表" className="library-card-list" role="list">
                {visibleNotes.map((note) => {
                  const firstAttachment = attachmentsById.get(note.attachmentIds[0]);
                  return (
                    <button
                      aria-pressed={selectedId === note.id}
                      className="library-note-card"
                      key={note.id}
                      onClick={() => { cancelEdit(); setSelectedId(note.id); }}
                      role="listitem"
                      type="button"
                    >
                      <div className="library-note-card__body">
                        <strong>{noteTitle(note)}</strong>
                        <p>{note.content || '图片笔记'}</p>
                        {(note.stockName || note.stockCode) ? <span>{[note.stockName, note.stockCode].filter(Boolean).join(' · ')}</span> : null}
                        <div className="library-note-card__meta">
                          <time dateTime={note.updatedAt}>{formatDate(note.updatedAt)}</time>
                          <span>{note.categoryId ? categoryNames.get(note.categoryId) ?? '未分类' : '未分类'}</span>
                        </div>
                        {note.tagIds.length > 0 ? <div className="library-tags">{note.tagIds.map((id) => tagNames.get(id)).filter(Boolean).map((name) => <span key={name}>{name}</span>)}</div> : null}
                      </div>
                      {firstAttachment ? <AttachmentImage attachment={firstAttachment} compact onOpen={setPreview} /> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-label="笔记详情" className="library-detail">
            {!selectedNote ? <div className="library-panel-empty">选择一条笔记查看详情。</div> : editor ? (
              <div className="library-editor">
                <div className="library-detail__header"><h2>编辑笔记</h2></div>
                <Input label="标题" value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} />
                <Input label="正文" multiline value={editor.content} onChange={(event) => setEditor({ ...editor, content: event.target.value })} />
                <label className="field"><span className="field__label">分类</span><select aria-label="分类" value={editor.categoryId} onChange={(event) => setEditor({ ...editor, categoryId: event.target.value })}><option value="">未分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <div className="field"><span className="field__label">标签</span><div className="library-tag-choices">{tags.map((item) => <button aria-pressed={editor.tagIds.includes(item.id)} key={item.id} onClick={() => setEditor({ ...editor, tagIds: editor.tagIds.includes(item.id) ? editor.tagIds.filter((id) => id !== item.id) : [...editor.tagIds, item.id] })} type="button">标签 {item.name}</button>)}</div></div>
                <div className="library-stock-fields"><Input label="股票名称" value={editor.stockName} onChange={(event) => setEditor({ ...editor, stockName: event.target.value })} /><Input label="股票代码" value={editor.stockCode} onChange={(event) => setEditor({ ...editor, stockCode: event.target.value })} /></div>
                <div
                  className="library-editor-images"
                  data-testid="library-image-drop-zone"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); addImageDrafts(event.dataTransfer.files); }}
                  onPaste={(event) => addImageDrafts(Array.from(event.clipboardData.items).flatMap((item) => { const file = item.kind === 'file' ? item.getAsFile() : null; return file ? [file] : []; }))}
                  tabIndex={0}
                >
                  <span className="field__label">图片（可粘贴或拖入）</span>
                  <div className="library-editor-images__list">
                    {selectedNote.attachmentIds.filter((id) => !editor.removedAttachmentIds.includes(id)).map((id) => {
                      const item = attachmentsById.get(id);
                      return item ? <div className="library-editor-image" key={id}><AttachmentImage attachment={item} compact onOpen={setPreview} /><button aria-label={`移除已有图片 ${item.fileName}`} onClick={() => setEditor({ ...editor, removedAttachmentIds: [...editor.removedAttachmentIds, id] })} type="button">×</button></div> : null;
                    })}
                    {editor.newImages.map(({ file, url }) => <div className="library-editor-image" key={url}><img alt={`新增图片 ${file.name}`} src={url} /><button aria-label={`移除新增图片 ${file.name}`} onClick={() => { URL.revokeObjectURL(url); setEditor({ ...editor, newImages: editor.newImages.filter((item) => item.url !== url) }); }} type="button">×</button></div>)}
                  </div>
                </div>
                <div className="library-actions"><Button onClick={() => void saveEdit()}>保存修改</Button><Button variant="secondary" onClick={cancelEdit}>取消</Button></div>
              </div>
            ) : (
              <article>
                <div className="library-detail__header"><div><span>{selectedNote.categoryId ? categoryNames.get(selectedNote.categoryId) ?? '未分类' : '未分类'}</span><h2>{noteTitle(selectedNote)}</h2></div><div className="library-actions"><Button onClick={() => setEditor(createEditorState(selectedNote))} variant="secondary">编辑笔记</Button><Button className="button--danger" onClick={() => void deleteSelectedNote()} variant="ghost">删除笔记</Button></div></div>
                <p className="library-detail__content">{selectedNote.content}</p>
                {(selectedNote.stockName || selectedNote.stockCode) ? <div className="library-detail__stock">{[selectedNote.stockName, selectedNote.stockCode].filter(Boolean).join(' · ')}</div> : null}
                {selectedNote.tagIds.length > 0 ? <div className="library-tags">{selectedNote.tagIds.map((id) => tagNames.get(id)).filter(Boolean).map((name) => <span key={name}>{name}</span>)}</div> : null}
                <dl className="library-detail__dates"><div><dt>创建时间</dt><dd>{formatDate(selectedNote.createdAt)}</dd></div><div><dt>更新时间</dt><dd>{formatDate(selectedNote.updatedAt)}</dd></div></dl>
                {selectedNote.attachmentIds.length > 0 ? <div className="library-detail__images">{selectedNote.attachmentIds.map((id) => { const item = attachmentsById.get(id); return item ? <AttachmentImage attachment={item} key={id} onOpen={setPreview} /> : <span className="library-image-state" key={id}>图片不可用</span>; })}</div> : null}
              </article>
            )}
          </section>
        </div>
      ) : null}
      {preview ? <div aria-label="图片预览" aria-modal="true" className="image-preview" role="dialog"><div className="image-preview__panel"><button aria-label="关闭图片预览" onClick={() => setPreview(null)} type="button">×</button><img alt={`大图预览 ${preview.label}`} src={preview.url} /></div></div> : null}
    </div>
  );
}
