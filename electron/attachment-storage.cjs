const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_IMAGE_COUNT = 10;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_FORMATS = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
]);

class AttachmentError extends Error {
  constructor(message, code, cause) {
    super(message, { cause });
    this.name = 'AttachmentError';
    this.code = code;
  }
}

function normalizeImage(image) {
  const extension = path.extname(image?.name ?? '').toLowerCase();
  const inferredType = extension === '.png'
    ? 'image/png'
    : extension === '.jpg' || extension === '.jpeg'
      ? 'image/jpeg'
      : extension === '.webp'
        ? 'image/webp'
        : '';
  const type = IMAGE_FORMATS.has(image?.type) ? image.type : inferredType;
  if (!IMAGE_FORMATS.has(type)) {
    throw new AttachmentError('仅支持 PNG、JPG、JPEG 和 WebP 图片。', 'UNSUPPORTED_FORMAT');
  }

  const bytes = Buffer.from(image?.bytes ?? []);
  if (bytes.byteLength > MAX_IMAGE_SIZE) {
    throw new AttachmentError('单张图片不能超过 10MB。', 'FILE_TOO_LARGE');
  }
  return { bytes, type, extension: IMAGE_FORMATS.get(type) };
}

function safeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function createAttachmentStorage({
  attachmentsDirectory,
  createId = randomUUID,
  fileSystem = fs,
} = {}) {
  if (!attachmentsDirectory) throw new Error('attachmentsDirectory is required');

  async function removeNoteDirectory(noteDirectory) {
    await fileSystem.rm(noteDirectory, { force: true, recursive: true });
  }

  function resolveRegisteredPath(filePath) {
    const root = path.resolve(attachmentsDirectory);
    const target = path.resolve(filePath);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new AttachmentError('附件路径无效。', 'INVALID_PATH');
    }
    return target;
  }

  async function removeAttachment(attachment) {
    const target = resolveRegisteredPath(attachment.filePath);
    try {
      await fileSystem.rm(target, { force: true });
    } catch (error) {
      throw new AttachmentError('本地图片文件无法删除。', 'DELETE_FAILED', error);
    }
  }

  async function readAttachment(attachment) {
    const target = resolveRegisteredPath(attachment.filePath);
    try {
      const bytes = await fileSystem.readFile(target);
      return { id: attachment.id, type: attachment.type, bytes: Uint8Array.from(bytes) };
    } catch (error) {
      throw new AttachmentError('本地图片文件不存在或无法读取。', 'READ_FAILED', error);
    }
  }

  async function saveImages({ noteId, createdAt, images = [] }) {
    if (images.length > MAX_IMAGE_COUNT) {
      throw new AttachmentError('单条笔记最多添加 10 张图片。', 'TOO_MANY_FILES');
    }

    const normalized = images.map(normalizeImage);
    if (normalized.length === 0) return [];

    const date = new Date(createdAt);
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const noteDirectory = path.join(
      attachmentsDirectory,
      month,
      `note_${safeSegment(noteId)}`,
    );

    const attachments = normalized.map((image) => {
      const id = createId();
      const fileName = `${safeSegment(id)}${image.extension}`;
      return {
        id,
        noteId,
        type: image.type,
        fileName,
        filePath: path.join(noteDirectory, fileName),
        createdAt,
      };
    });

    const writtenAttachments = [];
    try {
      await fileSystem.mkdir(noteDirectory, { recursive: true });
      for (let index = 0; index < attachments.length; index += 1) {
        await fileSystem.writeFile(attachments[index].filePath, normalized[index].bytes);
        writtenAttachments.push(attachments[index]);
      }
      return attachments;
    } catch (error) {
      await Promise.allSettled(writtenAttachments.map(({ filePath }) => (
        fileSystem.rm(filePath, { force: true })
      )));
      throw new AttachmentError('图片保存失败，请检查本地数据目录。', 'WRITE_FAILED', error);
    }
  }

  return {
    readAttachment,
    removeAttachment,
    removeNoteDirectory,
    saveImages,
  };
}

module.exports = {
  AttachmentError,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE,
  createAttachmentStorage,
};
