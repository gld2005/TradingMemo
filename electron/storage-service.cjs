const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const SCHEMA_VERSION = 2;

class StorageError extends Error {
  constructor(message, code, cause) {
    super(message, { cause });
    this.name = 'StorageError';
    this.code = code;
  }
}

function emptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    defaultCategoriesInitialized: false,
    notes: [],
    categories: [],
    tags: [],
    attachments: [],
  };
}

function isStorageData(value) {
  return Boolean(
    value
      && typeof value === 'object'
      && value.schemaVersion === SCHEMA_VERSION
      && Array.isArray(value.notes)
      && Array.isArray(value.categories)
      && Array.isArray(value.tags)
      && Array.isArray(value.attachments),
  );
}

function upgradeData(value) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1) return value;
  if (![value.notes, value.categories, value.tags, value.attachments].every(Array.isArray)) return value;
  return {
    ...value,
    schemaVersion: SCHEMA_VERSION,
    defaultCategoriesInitialized: value.categories.length > 0,
    notes: value.notes.map((note) => ({
      ...note,
      categoryId: note.categoryId ?? null,
      tagIds: Array.isArray(note.tagIds) ? note.tagIds : [],
      stockName: note.stockName ?? null,
      stockCode: note.stockCode ?? null,
      attachmentIds: Array.isArray(note.attachmentIds) ? note.attachmentIds : [],
    })),
    tags: value.tags.map((tag) => ({ ...tag, usageCount: Number(tag.usageCount) || 0 })),
  };
}

function createStorageService({ dataDirectory, fileSystem = fs } = {}) {
  if (!dataDirectory) throw new Error('dataDirectory is required');
  const dataFilePath = path.join(dataDirectory, 'notes.json');

  async function writeData(data) {
    if (!isStorageData(data)) {
      throw new StorageError('本地数据格式无效。', 'INVALID_DATA');
    }

    const temporaryPath = `${dataFilePath}.tmp-${randomUUID()}`;
    try {
      await fileSystem.mkdir(dataDirectory, { recursive: true });
      await fileSystem.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      await fileSystem.rename(temporaryPath, dataFilePath);
    } catch (error) {
      try {
        await fileSystem.rm(temporaryPath, { force: true });
      } catch {
        // Keep the original storage failure as the public error.
      }
      if (error instanceof StorageError) throw error;
      throw new StorageError('无法保存本地笔记，请检查数据目录权限。', 'WRITE_FAILED', error);
    }
  }

  async function readData() {
    let content;
    try {
      content = await fileSystem.readFile(dataFilePath, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return initStorage();
      throw new StorageError('无法读取本地笔记，请检查数据目录权限。', 'READ_FAILED', error);
    }

    if (!content.trim()) return initStorage();

    try {
      const parsed = JSON.parse(content);
      const data = upgradeData(parsed);
      if (!isStorageData(data)) {
        throw new StorageError('本地数据文件格式无效，请检查 notes.json。', 'CORRUPTED_DATA');
      }
      if (parsed.schemaVersion !== data.schemaVersion) await writeData(data);
      return data;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError('本地数据文件已损坏，请检查 notes.json。', 'CORRUPTED_DATA', error);
    }
  }

  async function initStorage() {
    try {
      const content = await fileSystem.readFile(dataFilePath, 'utf8');
      if (content.trim()) return readData();
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw new StorageError('无法初始化本地数据目录。', 'INIT_FAILED', error);
      }
    }

    const data = emptyData();
    await writeData(data);
    return data;
  }

  return {
    dataDirectory,
    dataFilePath,
    initStorage,
    readData,
    writeData,
  };
}

module.exports = { SCHEMA_VERSION, StorageError, createStorageService, emptyData, upgradeData };
