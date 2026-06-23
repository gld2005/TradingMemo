import {
  ClipboardEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { readFileBytes, selectImageDrafts } from '../app/image-drafts';
import { Button } from './Button';
import { Input } from './Input';

type ImageDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

type NoteComposerProps = {
  autoFocus?: boolean;
  className?: string;
  onSaved?: () => void | Promise<void>;
  variant: 'compact' | 'full';
};

let nextDraftId = 0;

function defaultSettings(): AppSettings {
  return {
    schemaVersion: 1,
    theme: 'light',
    floatingShortcut: 'Alt+J',
    defaultCategoryId: null,
    onboardingDismissed: false,
  };
}

export function NoteComposer({
  autoFocus = false,
  className = '',
  onSaved,
  variant,
}: NoteComposerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [stockName, setStockName] = useState('');
  const [stockCode, setStockCode] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageDrafts, setImageDrafts] = useState<ImageDraft[]>([]);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageDraftsRef = useRef<ImageDraft[]>([]);

  const loadOrganizationData = useCallback(async () => {
    if (!window.desktop) return;
    const [categoryItems, tagItems, settings] = await Promise.all([
      window.desktop.getCategories(),
      window.desktop.getTags(),
      window.desktop.getSettings?.() ?? Promise.resolve(defaultSettings()),
    ]);
    setCategories(categoryItems);
    setTags(tagItems);
    setCategoryId((current) => (
      categoryItems.some(({ id }) => id === current)
        ? current
        : settings.defaultCategoryId || ''
    ));
    setSelectedTagIds((current) => current.filter((id) => tagItems.some((tag) => tag.id === id)));
  }, []);

  useEffect(() => {
    void loadOrganizationData().catch(() => {
      setFeedback('读取分类和标签失败，请检查本地数据。');
    });
    if (autoFocus) requestAnimationFrame(() => inputRef.current?.focus());
  }, [autoFocus, loadOrganizationData]);

  useEffect(() => {
    if (!window.desktop) return;
    const removeNotesListener = window.desktop.onNotesChanged(() => {
      void loadOrganizationData().catch(() => {
        setFeedback('读取分类和标签失败，请检查本地数据。');
      });
    });
    const removeShownListener = window.desktop.onFloatingShown?.(() => {
      if (autoFocus) requestAnimationFrame(() => inputRef.current?.focus());
      void loadOrganizationData().catch(() => {
        setFeedback('读取分类和标签失败，请检查本地数据。');
      });
    }) ?? (() => undefined);
    return () => {
      removeNotesListener();
      removeShownListener();
    };
  }, [autoFocus, loadOrganizationData]);

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
    if (!name) {
      setFeedback('标签名称不能为空。');
      return;
    }
    const existing = tags.find((tag) => tag.name === name);
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) toggleTag(existing.id);
      setNewTagName('');
      return;
    }
    if (selectedTagIds.length >= 10) {
      setFeedback('单条笔记最多添加 10 个标签。');
      return;
    }
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
      await onSaved?.();
    } catch {
      setFeedback('保存失败，请检查本地数据文件后重试。');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className={`note-composer note-composer--${variant} floating-form ${className}`.trim()}
      onSubmit={(event) => void saveNote(event)}
    >
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
          rows={variant === 'full' ? 6 : 4}
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
      <p aria-live="polite" className="floating-feedback">{feedback}</p>
    </form>
  );
}
