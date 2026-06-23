import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { NoteComposer } from '../components/NoteComposer';
import { PageHeader } from '../components/PageHeader';

type ImagePreview = { url: string; label: string };

function isCurrentLocalDay(value: string, current = new Date()) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === current.getFullYear()
    && date.getMonth() === current.getMonth()
    && date.getDate() === current.getDate();
}

function AttachmentThumbnail({
  attachment,
  onOpen,
}: {
  attachment: Attachment;
  onOpen: (preview: ImagePreview) => void;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [url, setUrl] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    void window.desktop.readAttachment(attachment.id)
      .then((content) => {
        if (!active) return;
        const bytes = Uint8Array.from(content.bytes);
        objectUrl = URL.createObjectURL(new Blob([bytes.buffer], { type: content.type }));
        setUrl(objectUrl);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('missing');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  if (status === 'missing') return <span className="note-image--missing">图片不可用</span>;
  if (status === 'loading') return <span className="note-image--loading">读取中</span>;
  return (
    <button
      aria-label={`查看图片 ${attachment.fileName}`}
      className="note-image"
      onClick={() => onOpen({ url, label: attachment.fileName })}
      type="button"
    >
      <img alt={`笔记附件 ${attachment.fileName}`} src={url} />
    </button>
  );
}

export function TodayPage() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(window.desktop));
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [preview, setPreview] = useState<ImagePreview | null>(null);

  const loadNotes = useCallback(async () => {
    if (!window.desktop) return;
    setLoading(true);
    setError('');
    try {
      const [savedNotes, savedCategories, savedTags] = await Promise.all([
        window.desktop.getAllNotes(),
        window.desktop.getCategories(),
        window.desktop.getTags(),
      ]);
      const todayNotes = savedNotes.filter((note) => isCurrentLocalDay(note.createdAt));
      const attachmentIds = todayNotes.flatMap((note) => note.attachmentIds);
      const savedAttachments = attachmentIds.length > 0
        ? await window.desktop.getAttachments(attachmentIds)
        : [];
      setNotes(todayNotes);
      setCategories(savedCategories);
      setTags(savedTags);
      setAttachments(savedAttachments);
    } catch {
      setError('读取本地笔记失败，请检查数据文件。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotes();
    if (!window.desktop) return;
    return window.desktop.onNotesChanged(() => void loadNotes());
  }, [loadNotes]);

  const categoryNames = useMemo(
    () => new Map(categories.map(({ id, name }) => [id, name])),
    [categories],
  );
  const attachmentsById = useMemo(
    () => new Map(attachments.map((attachment) => [attachment.id, attachment])),
    [attachments],
  );
  const tagNames = useMemo(() => new Map(tags.map(({ id, name }) => [id, name])), [tags]);

  return (
    <div className="page today-page">
      <PageHeader title="今日记录" />
      <div className="today-layout">
        <section aria-label="今日已保存记录" className="today-records" role="region">
          {error ? <Card className="notes-status notes-status--error">{error}</Card> : null}
          {!error && loading ? <Card className="notes-status">正在读取本地笔记…</Card> : null}
          {!error && !loading && notes.length === 0 ? (
            <EmptyState message="今天还没有记录" />
          ) : null}
          {!error && !loading && notes.length > 0 ? (
            <div className="notes-list" aria-label="已保存笔记">
              {notes.map((note) => (
                <Card className="note-row" key={note.id}>
                  <time dateTime={note.createdAt}>
                    {new Date(note.createdAt).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </time>
                  <div className="note-row__content">
                    <p>{note.content.length > 80 ? `${note.content.slice(0, 80)}…` : note.content}</p>
                    {(note.stockName || note.stockCode) ? (
                      <div className="note-row__stock">{[note.stockName, note.stockCode].filter(Boolean).join(' · ')}</div>
                    ) : null}
                    {note.tagIds?.length > 0 ? (
                      <div aria-label="笔记标签" className="note-row__tags">
                        {note.tagIds.map((id) => tagNames.get(id)).filter(Boolean).map((name) => <span key={name}>{name}</span>)}
                      </div>
                    ) : null}
                    {note.attachmentIds.length > 0 ? (
                      <div aria-label="笔记图片" className="note-images">
                        {note.attachmentIds.slice(0, 3).map((id) => {
                          const attachment = attachmentsById.get(id);
                          return attachment ? (
                            <AttachmentThumbnail attachment={attachment} key={id} onOpen={setPreview} />
                          ) : <span className="note-image--missing" key={id}>图片不可用</span>;
                        })}
                        {note.attachmentIds.length > 3 ? (
                          <span className="note-images__more">+{note.attachmentIds.length - 3}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <span>{note.categoryId ? categoryNames.get(note.categoryId) ?? '未分类' : '未分类'}</span>
                </Card>
              ))}
            </div>
          ) : null}
        </section>
        <section aria-label="记录输入区" className="today-composer" role="region">
          <Card className="today-composer__card">
            <NoteComposer onSaved={loadNotes} variant="full" />
          </Card>
        </section>
      </div>
      {preview ? (
        <div aria-label="图片预览" aria-modal="true" className="image-preview" role="dialog">
          <div className="image-preview__panel">
            <button aria-label="关闭图片预览" onClick={() => setPreview(null)} type="button">×</button>
            <img alt={`大图预览 ${preview.label}`} src={preview.url} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
