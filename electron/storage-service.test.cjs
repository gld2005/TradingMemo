const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createStorageService, StorageError } = require('./storage-service.cjs');

async function withStorage(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'trading-memo-storage-'));
  const service = createStorageService({ dataDirectory: directory });
  try {
    await run({ directory, service });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test('initializes a missing or empty data file with schema version 2', async () => {
  await withStorage(async ({ directory, service }) => {
    const initialized = await service.initStorage();
    assert.deepEqual(initialized, {
      schemaVersion: 2,
      defaultCategoriesInitialized: false,
      notes: [],
      categories: [],
      tags: [],
      attachments: [],
    });

    await writeFile(path.join(directory, 'notes.json'), '', 'utf8');
    const reinitialized = await service.initStorage();
    assert.equal(reinitialized.schemaVersion, 2);
    assert.deepEqual(reinitialized.notes, []);
  });
});

test('upgrades schema version 1 notes with missing Batch 5 fields without changing attachments', async () => {
  await withStorage(async ({ directory, service }) => {
    await writeFile(path.join(directory, 'notes.json'), JSON.stringify({
      schemaVersion: 1,
      notes: [{
        id: 'legacy-note', content: '旧图文笔记', attachmentIds: ['attachment-1'],
        createdAt: '2026-06-20T08:00:00.000Z', updatedAt: '2026-06-20T08:00:00.000Z',
      }],
      categories: [], tags: [],
      attachments: [{ id: 'attachment-1', noteId: 'legacy-note', filePath: 'old.png' }],
    }), 'utf8');

    const upgraded = await service.readData();

    assert.equal(upgraded.schemaVersion, 2);
    assert.equal(upgraded.defaultCategoriesInitialized, false);
    assert.deepEqual(upgraded.notes[0].attachmentIds, ['attachment-1']);
    assert.equal(upgraded.notes[0].categoryId, null);
    assert.deepEqual(upgraded.notes[0].tagIds, []);
    assert.equal(upgraded.notes[0].stockName, null);
    assert.equal(upgraded.notes[0].stockCode, null);
    assert.equal(upgraded.attachments[0].id, 'attachment-1');
  });
});

test('persists structured data so a new service instance can read it', async () => {
  await withStorage(async ({ directory, service }) => {
    await service.initStorage();
    const data = await service.readData();
    data.notes.push({ id: 'note-1', content: '持久化内容' });
    await service.writeData(data);

    const restartedService = createStorageService({ dataDirectory: directory });
    const restartedData = await restartedService.readData();
    assert.equal(restartedData.notes[0].content, '持久化内容');
  });
});

test('reports a friendly storage error for corrupted JSON', async () => {
  await withStorage(async ({ directory, service }) => {
    await writeFile(path.join(directory, 'notes.json'), '{broken', 'utf8');

    await assert.rejects(
      service.readData(),
      (error) => error instanceof StorageError && error.code === 'CORRUPTED_DATA',
    );

    assert.equal(await readFile(path.join(directory, 'notes.json'), 'utf8'), '{broken');
  });
});

test('keeps the previous notes file intact when writing the replacement fails', async () => {
  const directory = path.join(os.tmpdir(), 'trading-memo-atomic');
  const dataFilePath = path.join(directory, 'notes.json');
  const original = `${JSON.stringify({
    schemaVersion: 2,
    notes: [{ id: 'old-note', content: '原内容' }],
    categories: [], tags: [], attachments: [],
  })}\n`;
  const files = new Map([[dataFilePath, original]]);
  const fileSystem = {
    mkdir: async () => undefined,
    readFile: async (filePath) => files.get(filePath),
    writeFile: async (filePath, content) => {
      files.set(filePath, content);
      throw new Error('disk full');
    },
    rename: async (from, to) => files.set(to, files.get(from)),
    rm: async (filePath) => files.delete(filePath),
  };
  const service = createStorageService({ dataDirectory: directory, fileSystem });

  await assert.rejects(service.writeData({
    schemaVersion: 2,
    notes: [{ id: 'new-note', content: '新内容' }],
    categories: [], tags: [], attachments: [],
  }), (error) => error instanceof StorageError && error.code === 'WRITE_FAILED');
  assert.equal(files.get(dataFilePath), original);
});
