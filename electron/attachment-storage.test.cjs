const assert = require('node:assert/strict');
const { access, mkdtemp, readFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  AttachmentError,
  createAttachmentStorage,
} = require('./attachment-storage.cjs');

async function withAttachmentStorage(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'trading-memo-attachments-'));
  const storage = createAttachmentStorage({
    attachmentsDirectory: directory,
    createId: (() => { let id = 0; return () => `attachment-${++id}`; })(),
  });
  try {
    await run({ directory, storage });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test('saves supported images under a generated note directory with unique names', async () => {
  await withAttachmentStorage(async ({ directory, storage }) => {
    const attachments = await storage.saveImages({
      noteId: 'note-1',
      createdAt: '2026-06-21T08:00:00.000Z',
      images: [
        { name: '用户截图.png', type: 'image/png', bytes: Uint8Array.from([1, 2, 3]) },
        { name: '用户截图.png', type: 'image/jpeg', bytes: Uint8Array.from([4, 5]) },
      ],
    });

    assert.deepEqual(attachments.map(({ id, noteId, type, fileName, createdAt }) => ({
      id, noteId, type, fileName, createdAt,
    })), [
      {
        id: 'attachment-1', noteId: 'note-1', type: 'image/png',
        fileName: 'attachment-1.png', createdAt: '2026-06-21T08:00:00.000Z',
      },
      {
        id: 'attachment-2', noteId: 'note-1', type: 'image/jpeg',
        fileName: 'attachment-2.jpg', createdAt: '2026-06-21T08:00:00.000Z',
      },
    ]);
    assert.equal(await readFile(attachments[0].filePath, 'hex'), '010203');
    assert.equal(await readFile(attachments[1].filePath, 'hex'), '0405');
    assert.equal(attachments[0].filePath.startsWith(path.join(directory, '2026-06', 'note_note-1')), true);
  });
});

test('rejects unsupported, oversized, and excess images before writing files', async () => {
  await withAttachmentStorage(async ({ directory, storage }) => {
    await assert.rejects(
      storage.saveImages({
        noteId: 'note-1', createdAt: '2026-06-21T08:00:00.000Z',
        images: [{ name: 'document.txt', type: 'text/plain', bytes: Uint8Array.from([1]) }],
      }),
      (error) => error instanceof AttachmentError && error.code === 'UNSUPPORTED_FORMAT',
    );
    await assert.rejects(
      storage.saveImages({
        noteId: 'note-1', createdAt: '2026-06-21T08:00:00.000Z',
        images: [{ name: 'large.png', type: 'image/png', bytes: new Uint8Array(10 * 1024 * 1024 + 1) }],
      }),
      (error) => error instanceof AttachmentError && error.code === 'FILE_TOO_LARGE',
    );
    await assert.rejects(
      storage.saveImages({
        noteId: 'note-1', createdAt: '2026-06-21T08:00:00.000Z',
        images: Array.from({ length: 11 }, () => ({
          name: 'image.webp', type: 'image/webp', bytes: Uint8Array.from([1]),
        })),
      }),
      (error) => error instanceof AttachmentError && error.code === 'TOO_MANY_FILES',
    );
    await assert.rejects(access(path.join(directory, '2026-06')));
  });
});

test('removes files already written when a later image write fails', async () => {
  const written = [];
  const removed = [];
  const fileSystem = {
    mkdir: async () => undefined,
    writeFile: async (filePath) => {
      written.push(filePath);
      if (written.length === 2) throw new Error('disk full');
    },
    rm: async (target, options) => { removed.push({ target, options }); },
  };
  const storage = createAttachmentStorage({
    attachmentsDirectory: 'C:\\user-data\\app-data\\attachments',
    createId: (() => { let id = 0; return () => `attachment-${++id}`; })(),
    fileSystem,
  });

  await assert.rejects(
    storage.saveImages({
      noteId: 'note-1',
      createdAt: '2026-06-21T08:00:00.000Z',
      images: [
        { name: 'one.png', type: 'image/png', bytes: Uint8Array.from([1]) },
        { name: 'two.png', type: 'image/png', bytes: Uint8Array.from([2]) },
      ],
    }),
    (error) => error instanceof AttachmentError && error.code === 'WRITE_FAILED',
  );
  assert.deepEqual(removed, [{
    target: written[0],
    options: { force: true },
  }]);
});

test('reads registered attachment bytes only from inside the attachment directory', async () => {
  await withAttachmentStorage(async ({ directory, storage }) => {
    const [attachment] = await storage.saveImages({
      noteId: 'note-1',
      createdAt: '2026-06-21T08:00:00.000Z',
      images: [{ name: 'one.png', type: 'image/png', bytes: Uint8Array.from([9, 8, 7]) }],
    });

    const result = await storage.readAttachment(attachment);
    assert.equal(result.type, 'image/png');
    assert.deepEqual(Array.from(result.bytes), [9, 8, 7]);

    await assert.rejects(
      storage.readAttachment({ ...attachment, filePath: path.join(directory, '..', 'secret.png') }),
      (error) => error instanceof AttachmentError && error.code === 'INVALID_PATH',
    );
  });
});

test('removes only registered attachment files inside the attachment directory', async () => {
  await withAttachmentStorage(async ({ directory, storage }) => {
    const [attachment] = await storage.saveImages({
      noteId: 'note-1',
      createdAt: '2026-06-21T08:00:00.000Z',
      images: [{ name: 'one.png', type: 'image/png', bytes: Uint8Array.from([1]) }],
    });

    await storage.removeAttachment(attachment);
    await assert.rejects(access(attachment.filePath));
    await assert.rejects(
      storage.removeAttachment({ ...attachment, filePath: path.join(directory, '..', 'secret.png') }),
      (error) => error instanceof AttachmentError && error.code === 'INVALID_PATH',
    );
  });
});
