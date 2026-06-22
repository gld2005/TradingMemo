import {
  ClipboardEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { readFileBytes, selectImageDrafts } from './image-drafts';

type ImageDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

let nextDraftId = 0;

function resolveTheme(theme: AppSettings['theme']): 'light' | 'dark' {
  return theme === 'system' && typeof matchMedia === 'function'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme === 'dark' ? 'dark' : 'light';
}

export function FloatingWindow() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [stockName, setStockName] = useState('');
  const [stockCode, setStockCode] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isMini, setIsMini] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageDrafts, setImageDrafts] = useState<ImageDraft[]>([]);
  const [text, setText] = useState('');
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageDraftsRef = useRef<ImageDraft[]>([]);

  const loadOrganizationData = useCallback(async () => {
    const [categoryItems, tagItems, settings] = await Promise.all([
      window.desktop.getCategories(), window.desktop.getTags(), window.desktop.getSettings?.() ?? Promise.resolve({schemaVersion:1,theme:'light',floatingShortcut:'Alt+J',defaultCategoryId:null,onboardingDismissed:false} as AppSettings),
    ]);
    setCategories(categoryItems);
    setTags(tagItems);
    setCategoryId((current) => categoryItems.some(({ id }) => id === current) ? current : (settings.defaultCategoryId||''));
    setTheme(resolveTheme(settings.theme));
    setSelectedTagIds((current) => current.filter((id) => tagItems.some((tag) => tag.id === id)));
  }, []);

  useEffect(() => {
    if (!window.desktop) return;
    void loadOrganizationData()
      .catch(() => setFeedback('读取分类和标签失败，请检查本地数据。'));
    const removeShownListener = window.desktop.onFloatingShown(() => {
      inputRef.current?.focus();
      void loadOrganizationData().catch(() => setFeedback('读取分类和标签失败，请检查本地数据。'));
    });
    const removeNotesListener = window.desktop.onNotesChanged(() => {
      void loadOrganizationData().catch(() => setFeedback('读取分类和标签失败，请检查本地数据。'));
    });
    return () => {
      removeShownListener();
      removeNotesListener();
    };
  }, [loadOrganizationData]);

  useEffect(() => {
    if (!window.desktop?.onSettingsChanged) return;
    return window.desktop.onSettingsChanged((settings) => {
      setTheme(resolveTheme(settings.theme));
      setCategoryId((current) => current || (
        settings.defaultCategoryId && categories.some(({ id }) => id === settings.defaultCategoryId)
          ? settings.defaultCategoryId : ''
      ));
    });
  }, [categories]);

  useEffect(() => {
    if (typeof matchMedia !== 'function' || !window.desktop?.getSettings) return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      void window.desktop.getSettings().then((settings) => {
        if (settings.theme === 'system') setTheme(resolveTheme('system'));
      });
    };
    media.addEventListener?.('change', listener);
    return () => media.removeEventListener?.('change', listener);
  }, []);

  useEffect(() => () => {
    imageDraftsRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  }, []);

  function replaceImageDrafts(next: ImageDraft[]) {
    imageDraftsRef.current = next;
    setImageDrafts(next);
  }

  function addImageDrafts(files: Iterable<File>) {
    const selection = selectImageDrafts(files, imageDraftsRef.current.length);
    const added = selection.accepted.map((file) => ({
      id: `draft-${nextDraftId += 1}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    if (added.length > 0) replaceImageDrafts([...imageDraftsRef.current, ...added]);
    setFeedback(selection.message);
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter(({ kind }) => kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (files.length === 0) return;
    event.preventDefault();
    addImageDrafts(files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addImageDrafts(event.dataTransfer.files);
  }

  function removeImageDraft(id: string) {
    const target = imageDraftsRef.current.find((draft) => draft.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    replaceImageDrafts(imageDraftsRef.current.filter((draft) => draft.id !== id));
    setFeedback('');
  }

  function setMode(mode: FloatingMode) {
    setIsMini(mode === 'mini');
    void window.desktop?.setFloatingMode(mode);
    if (mode === 'expanded') requestAnimationFrame(() => inputRef.current?.focus());
  }

  function toggleTag(id: string) {
    setSelectedTagIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 10) {
        setFeedback('单条笔记最多添加 10 个标签。');
        return current;
      }
      setFeedback('');
      return [...current, id];
    });
  }

  async function addTag() {
    const name = newTagName.trim();
    if (!name) return setFeedback('标签名称不能为空。');
    const existing = tags.find((tag) => tag.name === name);
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) toggleTag(existing.id);
      setNewTagName('');
      return;
    }
    if (selectedTagIds.length >= 10) return setFeedback('单条笔记最多添加 10 个标签。');
    try {
      const created = await window.desktop.createTag({ name });
      setTags((current) => [...current, created]);
      setSelectedTagIds((current) => [...current, created.id]);
      setNewTagName('');
      setFeedback('');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '创建标签失败，请重试。');
    }
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() && imageDrafts.length === 0) return;
    if (!window.desktop) {
      setFeedback('保存仅在桌面应用中可用。');
      return;
    }

    setIsSaving(true);
    setFeedback('');
    try {
      const images = await Promise.all(imageDrafts.map(async ({ file }) => ({
        name: file.name,
        type: file.type,
        bytes: await readFileBytes(file),
      })));
      await window.desktop.createNote({
        content: text,
        categoryId: categoryId || null,
        tagIds: selectedTagIds,
        stockName,
        stockCode,
        ...(images.length > 0 ? { images } : {}),
      });
      setText('');
      setSelectedTagIds([]);
      setNewTagName('');
      setStockName('');
      setStockCode('');
      imageDrafts.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      replaceImageDrafts([]);
      setFeedback('笔记已保存到本地。');
      inputRef.current?.focus();
    } catch {
      setFeedback('保存失败，请检查本地数据文件后重试。');
    } finally {
      setIsSaving(false);
    }
  }

  if (isMini) {
    return (
      <div className="floating-shell floating-shell--mini" data-theme={theme}>
        <div className="floating-mini window-drag">
          <button
            aria-label="展开笔记浮窗"
            className="window-no-drag"
            onClick={() => setMode('expanded')}
            type="button"
          >
            <span aria-hidden="true">记</span>
            笔记
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="floating-shell" data-theme={theme}>
      <Card className="floating-card">
        <header className="floating-card__header window-drag">
          <div>
            <span className="floating-card__caption">快速记录</span>
            <h1>今日笔记</h1>
          </div>
          <div className="floating-card__window-actions window-no-drag">
            <button aria-label="折叠浮窗" onClick={() => setMode('mini')} type="button">—</button>
            <button
              aria-label="隐藏浮窗"
              onClick={() => void window.desktop?.hideFloatingWindow()}
              type="button"
            >
              ×
            </button>
          </div>
        </header>

        <form className="floating-form window-no-drag" onSubmit={(event) => void saveNote(event)}>
          <div
            className="image-drop-zone"
            data-active={isDragging}
            data-testid="image-drop-zone"
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <Input
              aria-label="笔记内容"
              multiline
              onChange={(event) => {
                setText(event.target.value);
                setFeedback('');
              }}
              onPaste={handlePaste}
              placeholder="输入学习心得或看盘经验..."
              ref={inputRef}
              rows={4}
              value={text}
            />
            <span className="image-drop-zone__hint">
              {isDragging ? '松开以添加图片' : '可粘贴或拖入图片'}
            </span>
          </div>

          {imageDrafts.length > 0 ? (
            <div aria-label="草稿图片" className="image-drafts">
              {imageDrafts.map((draft) => (
                <div className="image-draft" key={draft.id}>
                  <img alt={`草稿图片 ${draft.file.name}`} src={draft.previewUrl} />
                  <button
                    aria-label={`移除草稿图片 ${draft.file.name}`}
                    onClick={() => removeImageDraft(draft.id)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="floating-fields">
            <label className="floating-category">
              <span>分类</span>
              <select aria-label="分类选择" onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
                <option value="">未分类</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <div className="floating-stock-fields">
              <Input aria-label="股票名称" onChange={(event) => setStockName(event.target.value)} placeholder="股票名称（可选）" value={stockName} />
              <Input aria-label="股票代码" onChange={(event) => setStockCode(event.target.value)} placeholder="股票代码（可选）" value={stockCode} />
            </div>
            <div className="floating-tags">
              <div className="floating-tags__choices">
                {tags.map((tag) => (
                  <button aria-label={`标签 ${tag.name}`} aria-pressed={selectedTagIds.includes(tag.id)} key={tag.id} onClick={() => toggleTag(tag.id)} type="button">{tag.name}</button>
                ))}
              </div>
              <div className="floating-tags__add">
                <Input aria-label="新标签" onChange={(event) => setNewTagName(event.target.value)} placeholder="新标签" value={newTagName} />
                <button onClick={() => void addTag()} type="button">添加标签</button>
              </div>
            </div>
          </div>

          <div className="floating-form__footer">
            <span className="floating-form__hint">标签 {selectedTagIds.length}/10</span>
            <Button disabled={(!text.trim() && imageDrafts.length === 0) || isSaving} type="submit">
              {isSaving ? '保存中…' : '保存'}
            </Button>
          </div>
        </form>

        <p aria-live="polite" className="floating-feedback">{feedback}</p>
      </Card>
    </div>
  );
}
