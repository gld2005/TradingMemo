const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createAttachmentStorage } = require('./attachment-storage.cjs');
const { DEFAULT_CATEGORY_NAMES, createNotesRepository } = require('./notes-repository.cjs');
const { createStorageService } = require('./storage-service.cjs');

function createMemoryStorage(initialData) {
  let data = structuredClone(initialData ?? {
    schemaVersion: 2,
    defaultCategoriesInitialized: false,
    notes: [],
    categories: [],
    tags: [],
    attachments: [],
  });

  return {
    initStorage: async () => structuredClone(data),
    readData: async () => structuredClone(data),
    writeData: async (nextData) => {
      data = structuredClone(nextData);
    },
  };
}

test('initializes the ten default categories once', async () => {
  const repository = createNotesRepository({
    storage: createMemoryStorage(),
    createId: (() => { let id = 0; return () => `id-${++id}`; })(),
    now: () => '2026-06-21T08:00:00.000Z',
  });

  await repository.initStorage();
  await repository.ensureDefaultCategories();

  const categories = await repository.getCategories();
  assert.deepEqual(categories.map(({ name }) => name), DEFAULT_CATEGORY_NAMES);
  assert.deepEqual(categories.map(({ sortOrder }) => sortOrder), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

  await repository.ensureDefaultCategories();
  assert.equal((await repository.getCategories()).length, 10);
});

test('does not recreate a renamed or deleted default category after initialization', async () => {
  const repository = createNotesRepository({
    storage: createMemoryStorage(),
    createId: (() => { let id = 0; return () => `id-${++id}`; })(),
    now: () => '2026-06-21T08:00:00.000Z',
  });
  await repository.initStorage();
  const [first] = await repository.getCategories();
  await repository.updateCategory(first.id, { name: '已重命名分类' });

  await repository.ensureDefaultCategories();
  assert.equal((await repository.getCategories()).some(({ name }) => name === 'K线知识'), false);

  await repository.deleteCategory(first.id);
  await repository.ensureDefaultCategories();
  assert.equal((await repository.getCategories()).length, 9);
});

test('preserves existing schema version 2 categories when initialization marker is absent', async () => {
  const repository = createNotesRepository({
    storage: createMemoryStorage({
      schemaVersion: 2, notes: [], tags: [], attachments: [],
      categories: [{
        id: 'existing', name: '现有分类', color: null, sortOrder: 0,
        createdAt: '2026-06-21T08:00:00.000Z', updatedAt: '2026-06-21T08:00:00.000Z',
      }],
    }),
  });

  await repository.initStorage();
  assert.deepEqual((await repository.getCategories()).map(({ name }) => name), ['现有分类']);
});

test('creates and reads a trimmed plain-text note with timestamps and optional category', async () => {
  const repository = createNotesRepository({
    storage: createMemoryStorage(),
    createId: (() => { let id = 0; return () => `id-${++id}`; })(),
    now: () => '2026-06-21T08:00:00.000Z',
  });
  await repository.initStorage();
  await repository.ensureDefaultCategories();
  const [category] = await repository.getCategories();

  const note = await repository.createNote({
    content: '  这是一个超过二十个字符并用于验证自动标题的纯文字笔记内容  ',
    categoryId: category.id,
  });

  assert.equal(note.content, '这是一个超过二十个字符并用于验证自动标题的纯文字笔记内容');
  assert.equal(note.title, '这是一个超过二十个字符并用于验证自动标题');
  assert.equal(note.categoryId, category.id);
  assert.deepEqual(note.tagIds, []);
  assert.deepEqual(note.attachmentIds, []);
  assert.equal(note.createdAt, '2026-06-21T08:00:00.000Z');
  assert.equal(note.updatedAt, '2026-06-21T08:00:00.000Z');
  assert.deepEqual(await repository.getAllNotes(), [note]);
});

test('rejects empty note content', async () => {
  const repository = createNotesRepository({ storage: createMemoryStorage() });
  await assert.rejects(repository.createNote({ content: '   ' }), /笔记内容不能为空/);
});

test('reads the same note after storage and repository instances restart', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'trading-memo-restart-'));
  try {
    const firstRepository = createNotesRepository({
      storage: createStorageService({ dataDirectory: directory }),
    });
    await firstRepository.initStorage();
    const [category] = await firstRepository.getCategories();
    const tag = await firstRepository.createTag({ name: '重启验证' });
    const saved = await firstRepository.createNote({
      content: '应用重启后仍然存在的笔记',
      categoryId: category.id,
      tagIds: [tag.id],
      stockName: '贵州茅台',
      stockCode: '600519',
    });

    const restartedRepository = createNotesRepository({
      storage: createStorageService({ dataDirectory: directory }),
    });
    await restartedRepository.initStorage();
    const restartedNotes = await restartedRepository.getAllNotes();

    assert.equal(restartedNotes.length, 1);
    assert.equal(restartedNotes[0].id, saved.id);
    assert.equal(restartedNotes[0].content, '应用重启后仍然存在的笔记');
    assert.equal(restartedNotes[0].categoryId, category.id);
    assert.deepEqual(restartedNotes[0].tagIds, [tag.id]);
    assert.equal(restartedNotes[0].stockName, '贵州茅台');
    assert.equal(restartedNotes[0].stockCode, '600519');
    assert.equal((await restartedRepository.getTags())[0].usageCount, 1);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('creates an image note and links every saved attachment through attachmentIds', async () => {
  const storage = createMemoryStorage();
  const attachmentStorage = {
    saveImages: async ({ noteId, createdAt }) => [
      {
        id: 'attachment-1', noteId, type: 'image/png', fileName: 'attachment-1.png',
        filePath: 'C:\\app-data\\attachments\\note-1\\attachment-1.png', createdAt,
      },
      {
        id: 'attachment-2', noteId, type: 'image/jpeg', fileName: 'attachment-2.jpg',
        filePath: 'C:\\app-data\\attachments\\note-1\\attachment-2.jpg', createdAt,
      },
    ],
    removeNoteDirectory: async () => undefined,
  };
  const repository = createNotesRepository({
    storage,
    attachmentStorage,
    createId: () => 'note-1',
    now: () => '2026-06-21T08:00:00.000Z',
  });

  const note = await repository.createNote({
    content: '   ',
    images: [
      { name: 'one.png', type: 'image/png', bytes: Uint8Array.from([1]) },
      { name: 'two.jpg', type: 'image/jpeg', bytes: Uint8Array.from([2]) },
    ],
  });

  assert.equal(note.content, '图片笔记');
  assert.equal(note.title, '图片笔记');
  assert.deepEqual(note.attachmentIds, ['attachment-1', 'attachment-2']);
  assert.deepEqual((await repository.getAttachments(note.attachmentIds)).map(({ noteId }) => noteId), [
    'note-1', 'note-1',
  ]);
});

test('removes newly saved image files if writing note and attachment records fails', async () => {
  const data = {
    schemaVersion: 1, notes: [], categories: [], tags: [], attachments: [],
  };
  const storage = {
    readData: async () => structuredClone(data),
    writeData: async () => { throw new Error('notes.json is read only'); },
  };
  let removedNoteId = '';
  const attachmentStorage = {
    saveImages: async ({ noteId, createdAt }) => [{
      id: 'attachment-1', noteId, type: 'image/png', fileName: 'attachment-1.png',
      filePath: 'C:\\app-data\\attachments\\note_note-1\\attachment-1.png', createdAt,
    }],
    removeNoteDirectory: async (_directory) => { removedNoteId = 'note-1'; },
  };
  const repository = createNotesRepository({
    storage,
    attachmentStorage,
    createId: () => 'note-1',
    now: () => '2026-06-21T08:00:00.000Z',
  });

  await assert.rejects(repository.createNote({
    content: '带图笔记',
    images: [{ name: 'one.png', type: 'image/png', bytes: Uint8Array.from([1]) }],
  }), /notes.json is read only/);
  assert.equal(removedNoteId, 'note-1');
});

test('still rejects an empty note when it has no images', async () => {
  const repository = createNotesRepository({ storage: createMemoryStorage() });
  await assert.rejects(repository.createNote({ content: ' ', images: [] }), /笔记内容不能为空/);
});

test('reads the same image note and attachment bytes after repository restart', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'trading-memo-image-restart-'));
  const dataDirectory = path.join(directory, 'app-data');
  const attachmentsDirectory = path.join(dataDirectory, 'attachments');
  try {
    const firstAttachmentStorage = createAttachmentStorage({ attachmentsDirectory });
    const firstRepository = createNotesRepository({
      storage: createStorageService({ dataDirectory }),
      attachmentStorage: firstAttachmentStorage,
    });
    await firstRepository.initStorage();
    const saved = await firstRepository.createNote({
      content: '重启后仍在的图文笔记',
      images: [{ name: 'chart.png', type: 'image/png', bytes: Uint8Array.from([5, 4, 3]) }],
    });

    const restartedAttachmentStorage = createAttachmentStorage({ attachmentsDirectory });
    const restartedRepository = createNotesRepository({
      storage: createStorageService({ dataDirectory }),
      attachmentStorage: restartedAttachmentStorage,
    });
    await restartedRepository.initStorage();
    const [restartedNote] = await restartedRepository.getAllNotes();
    const [restartedAttachment] = await restartedRepository.getAttachments(saved.attachmentIds);
    const content = await restartedAttachmentStorage.readAttachment(restartedAttachment);

    assert.equal(restartedNote.id, saved.id);
    assert.deepEqual(restartedNote.attachmentIds, [restartedAttachment.id]);
    assert.equal(restartedAttachment.noteId, saved.id);
    assert.deepEqual(Array.from(content.bytes), [5, 4, 3]);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('creates, renames, and deletes an unused category with trimmed unique names', async () => {
  const repository = createNotesRepository({
    storage: createMemoryStorage(), createId: () => 'category-new',
    now: () => '2026-06-21T09:00:00.000Z',
  });
  const created = await repository.createCategory({ name: '  复盘方法  ' });
  assert.equal(created.name, '复盘方法');
  assert.equal(created.createdAt, '2026-06-21T09:00:00.000Z');
  await assert.rejects(repository.createCategory({ name: '复盘方法' }), /分类名称不能重复/);
  await assert.rejects(repository.createCategory({ name: '   ' }), /分类名称不能为空/);
  const renamed = await repository.updateCategory(created.id, { name: '  观察方法 ' });
  assert.equal(renamed.name, '观察方法');
  await repository.deleteCategory(created.id);
  assert.deepEqual(await repository.getCategories(), []);
});

test('prevents deleting a category referenced by a note', async () => {
  const repository = createNotesRepository({ storage: createMemoryStorage(), createId: () => 'id-1' });
  const category = await repository.createCategory({ name: '被使用分类' });
  await repository.createNote({ content: '关联笔记', categoryId: category.id });
  await assert.rejects(repository.deleteCategory(category.id), /已有笔记使用该分类/);
});

test('creates, renames, and deletes an unused tag with trimmed unique names', async () => {
  const repository = createNotesRepository({
    storage: createMemoryStorage(), createId: () => 'tag-new',
    now: () => '2026-06-21T09:00:00.000Z',
  });
  const created = await repository.createTag({ name: '  放量  ' });
  assert.equal(created.name, '放量');
  assert.equal(created.usageCount, 0);
  await assert.rejects(repository.createTag({ name: '放量' }), /标签名称不能重复/);
  await assert.rejects(repository.createTag({ name: ' ' }), /标签名称不能为空/);
  const renamed = await repository.updateTag(created.id, { name: '  缩量 ' });
  assert.equal(renamed.name, '缩量');
  await repository.deleteTag(created.id);
  assert.deepEqual(await repository.getTags(), []);
});

test('saves category, tags, and stock fields and keeps tag usage counts accurate', async () => {
  let id = 0;
  const repository = createNotesRepository({
    storage: createMemoryStorage(), createId: () => `id-${++id}`,
    now: () => '2026-06-21T09:00:00.000Z',
  });
  const category = await repository.createCategory({ name: '个股跟踪' });
  const tag = await repository.createTag({ name: '突破' });
  const note = await repository.createNote({
    content: '观察突破后的承接', categoryId: category.id, tagIds: [tag.id],
    stockName: '  贵州茅台 ', stockCode: ' 600519 ',
  });

  assert.equal(note.categoryId, category.id);
  assert.deepEqual(note.tagIds, [tag.id]);
  assert.equal(note.stockName, '贵州茅台');
  assert.equal(note.stockCode, '600519');
  assert.equal((await repository.getTags())[0].usageCount, 1);
  await assert.rejects(repository.deleteTag(tag.id), /已有笔记使用该标签/);
});

test('falls back to uncategorized and rejects missing or excessive tags when creating a note', async () => {
  const repository = createNotesRepository({ storage: createMemoryStorage() });
  const uncategorized = await repository.createNote({ content: '分类已失效', categoryId: 'missing' });
  assert.equal(uncategorized.categoryId, null);
  await assert.rejects(
    repository.createNote({ content: '标签失效', tagIds: ['missing'] }),
    /标签不存在/,
  );
  await assert.rejects(
    repository.createNote({ content: '标签太多', tagIds: Array.from({ length: 11 }, (_, i) => `tag-${i}`) }),
    /最多添加 10 个标签/,
  );
});

test('updates note fields and attachment links before cleaning removed image files', async () => {
  const storage = createMemoryStorage();
  const removed = [];
  let savedImageBatch = 0;
  const attachmentStorage = {
    saveImages: async ({ noteId, createdAt }) => {
      savedImageBatch += 1;
      const suffix = savedImageBatch === 1 ? 'old' : 'new';
      return [{
        id: `attachment-${suffix}`, noteId, type: 'image/png', fileName: `${suffix}.png`,
        filePath: `C:\\attachments\\${suffix}.png`, createdAt,
      }];
    },
    removeAttachment: async (attachment) => { removed.push(attachment.id); },
    removeNoteDirectory: async () => undefined,
  };
  let clock = '2026-06-21T08:00:00.000Z';
  let id = 0;
  const repository = createNotesRepository({
    storage, attachmentStorage, createId: () => `id-${++id}`, now: () => clock,
  });
  const category = await repository.createCategory({ name: '观察方法' });
  const tag = await repository.createTag({ name: '突破' });
  const created = await repository.createNote({
    content: '原始内容',
    images: [{ name: 'old.png', type: 'image/png', bytes: Uint8Array.from([1]) }],
  });
  clock = '2026-06-21T09:30:00.000Z';

  const result = await repository.updateNote(created.id, {
    title: '  新标题  ', content: '  更新后的正文  ', categoryId: category.id,
    tagIds: [tag.id], stockName: ' 贵州茅台 ', stockCode: ' 600519 ',
    removeAttachmentIds: ['attachment-old'],
    images: [{ name: 'new.png', type: 'image/png', bytes: Uint8Array.from([2]) }],
  });

  assert.equal(result.note.title, '新标题');
  assert.equal(result.note.content, '更新后的正文');
  assert.equal(result.note.categoryId, category.id);
  assert.deepEqual(result.note.tagIds, [tag.id]);
  assert.equal(result.note.stockName, '贵州茅台');
  assert.equal(result.note.stockCode, '600519');
  assert.deepEqual(result.note.attachmentIds, ['attachment-new']);
  assert.equal(result.note.createdAt, '2026-06-21T08:00:00.000Z');
  assert.equal(result.note.updatedAt, '2026-06-21T09:30:00.000Z');
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(removed, ['attachment-old']);
  assert.deepEqual((await repository.getAttachments(['attachment-new'])).map(({ id: itemId }) => itemId), ['attachment-new']);
});

test('validates updated tags before writing new image files', async () => {
  const storage = createMemoryStorage();
  let saveImagesCalls = 0;
  const attachmentStorage = {
    saveImages: async () => {
      saveImagesCalls += 1;
      return [];
    },
    removeAttachment: async () => undefined,
  };
  const repository = createNotesRepository({
    storage, attachmentStorage, createId: () => 'note-1',
    now: () => '2026-06-21T08:00:00.000Z',
  });
  const note = await repository.createNote({ content: '原始内容' });

  await assert.rejects(repository.updateNote(note.id, {
    title: '更新标题', content: '更新正文', categoryId: null,
    tagIds: ['missing-tag'], stockName: '', stockCode: '',
    removeAttachmentIds: [],
    images: [{ name: 'new.png', type: 'image/png', bytes: Uint8Array.from([1]) }],
  }), /标签不存在/);

  assert.equal(saveImagesCalls, 0);
  assert.equal((await repository.getAllNotes())[0].content, '原始内容');
});

test('deletes a note and attachment records while reporting file cleanup failures safely', async () => {
  const storage = createMemoryStorage();
  const attachmentStorage = {
    saveImages: async ({ noteId, createdAt }) => [{
      id: 'attachment-1', noteId, type: 'image/png', fileName: 'one.png',
      filePath: 'C:\\attachments\\one.png', createdAt,
    }],
    removeAttachment: async () => { throw new Error('file locked'); },
    removeNoteDirectory: async () => undefined,
  };
  const repository = createNotesRepository({
    storage, attachmentStorage, createId: () => 'note-1',
    now: () => '2026-06-21T08:00:00.000Z',
  });
  const note = await repository.createNote({
    content: '待删除', images: [{ name: 'one.png', type: 'image/png', bytes: Uint8Array.from([1]) }],
  });

  const result = await repository.deleteNote(note.id);

  assert.equal(result.note.id, note.id);
  assert.deepEqual(result.warnings, ['笔记已删除，但有 1 个本地图片文件未能清理。']);
  assert.deepEqual(await repository.getAllNotes(), []);
  assert.deepEqual(await repository.getAttachments(note.attachmentIds), []);
});
