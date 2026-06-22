const assert = require('node:assert/strict');
const test = require('node:test');
const { registerNotesIpc } = require('./notes-ipc.cjs');

test('registers minimal notes handlers and broadcasts after creating a note', async () => {
  const handlers = new Map();
  const ipcMain = {
    handle: (channel, handler) => handlers.set(channel, handler),
  };
  const note = { id: 'note-1', content: '记录内容' };
  const categories = [{ id: 'category-1', name: 'K线知识' }];
  const repository = {
    getAllNotes: async () => [note],
    createNote: async (input) => ({ ...note, ...input }),
    updateNote: async (id, input) => ({ note: { ...note, id, ...input }, warnings: [] }),
    deleteNote: async (id) => ({ note: { ...note, id }, warnings: [] }),
    getCategories: async () => categories,
    createCategory: async (input) => ({ id: 'category-2', ...input }),
    updateCategory: async (id, input) => ({ id, ...input }),
    deleteCategory: async (id) => ({ id }),
    getTags: async () => [{ id: 'tag-1', name: '突破', usageCount: 0 }],
    createTag: async (input) => ({ id: 'tag-2', usageCount: 0, ...input }),
    updateTag: async (id, input) => ({ id, usageCount: 0, ...input }),
    deleteTag: async (id) => ({ id }),
    getAttachments: async (ids) => ids.map((id) => ({
      id, noteId: 'note-1', type: 'image/png', filePath: `C:\\attachments\\${id}.png`,
    })),
  };
  const attachmentStorage = {
    readAttachment: async (attachment) => ({
      id: attachment.id,
      type: attachment.type,
      bytes: Uint8Array.from([1, 2, 3]),
    }),
  };
  let broadcasts = 0;

  registerNotesIpc({
    ipcMain,
    repository,
    attachmentStorage,
    dataFilePath: 'C:\\user-data\\app-data\\notes.json',
    broadcastNotesChanged: () => { broadcasts += 1; },
  });

  assert.deepEqual(await handlers.get('notes:get-all')(), [note]);
  assert.deepEqual(await handlers.get('notes:update')(null, 'note-1', { title: '更新' }), {
    note: { ...note, title: '更新' }, warnings: [],
  });
  assert.deepEqual(await handlers.get('notes:delete')(null, 'note-1'), {
    note, warnings: [],
  });
  assert.deepEqual(await handlers.get('categories:get')(), categories);
  assert.deepEqual(await handlers.get('categories:create')(null, { name: '新分类' }), { id: 'category-2', name: '新分类' });
  assert.deepEqual(await handlers.get('categories:update')(null, 'category-1', { name: '新名称' }), { id: 'category-1', name: '新名称' });
  assert.deepEqual(await handlers.get('categories:delete')(null, 'category-1'), { id: 'category-1' });
  assert.deepEqual(await handlers.get('tags:get')(), [{ id: 'tag-1', name: '突破', usageCount: 0 }]);
  assert.deepEqual(await handlers.get('tags:create')(null, { name: '放量' }), { id: 'tag-2', name: '放量', usageCount: 0 });
  assert.deepEqual(await handlers.get('storage:get-info')(), {
    dataFilePath: 'C:\\user-data\\app-data\\notes.json',
  });
  assert.deepEqual(await handlers.get('attachments:get')(null, ['attachment-1']), [{
    id: 'attachment-1', noteId: 'note-1', type: 'image/png',
    filePath: 'C:\\attachments\\attachment-1.png',
  }]);
  assert.deepEqual(await handlers.get('attachments:read')(null, 'attachment-1'), {
    id: 'attachment-1', type: 'image/png', bytes: Uint8Array.from([1, 2, 3]),
  });
  assert.deepEqual(await handlers.get('notes:create')(null, {
    content: '记录内容',
    categoryId: 'category-1',
  }), { ...note, categoryId: 'category-1' });
  assert.equal(broadcasts, 7);
});
