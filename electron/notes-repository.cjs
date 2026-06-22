const { randomUUID } = require('node:crypto');
const path = require('node:path');

const DEFAULT_CATEGORY_NAMES = [
  'K线知识',
  '分时图',
  '基本面',
  '财报理解',
  '题材逻辑',
  '政策新闻',
  '个股观察',
  '交易经验',
  '错误教训',
  '待研究',
];

function createNotesRepository({
  storage,
  attachmentStorage,
  createId = randomUUID,
  now = () => new Date().toISOString(),
} = {}) {
  if (!storage) throw new Error('storage is required');

  function cleanName(value, label) {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name) throw new Error(`${label}名称不能为空。`);
    return name;
  }

  function assertUnique(items, name, label, exceptId = null) {
    if (items.some((item) => item.id !== exceptId && item.name === name)) {
      throw new Error(`${label}名称不能重复。`);
    }
  }

  async function ensureDefaultCategories() {
    const data = await storage.readData();
    if (data.defaultCategoriesInitialized === true) return data.categories;
    if (data.defaultCategoriesInitialized == null) {
      data.defaultCategoriesInitialized = true;
      await storage.writeData(data);
      return data.categories;
    }
    const existingNames = new Set(data.categories.map(({ name }) => name));
    const timestamp = now();
    const missing = DEFAULT_CATEGORY_NAMES.filter((name) => !existingNames.has(name));

    if (missing.length > 0) {
      data.categories.push(...missing.map((name) => ({
        id: createId(),
        name,
        color: null,
        sortOrder: DEFAULT_CATEGORY_NAMES.indexOf(name),
        createdAt: timestamp,
        updatedAt: timestamp,
      })));
      data.categories.sort((left, right) => left.sortOrder - right.sortOrder);
    }

    data.defaultCategoriesInitialized = true;
    await storage.writeData(data);

    return data.categories;
  }

  async function initStorage() {
    await storage.initStorage();
    return ensureDefaultCategories();
  }

  async function getAllNotes() {
    const data = await storage.readData();
    return data.notes.slice().sort((left, right) => (
      (right.updatedAt || right.createdAt).localeCompare(left.updatedAt || left.createdAt)
    ));
  }

  async function createNote(input) {
    const images = Array.isArray(input?.images) ? input.images : [];
    const content = input?.content?.trim() || (images.length > 0 ? '图片笔记' : '');
    if (!content) throw new Error('笔记内容不能为空。');
    if (images.length > 0 && !attachmentStorage) {
      throw new Error('图片附件存储不可用。');
    }

    const data = await storage.readData();
    const requestedTagIds = [...new Set(Array.isArray(input?.tagIds) ? input.tagIds : [])];
    if (requestedTagIds.length > 10) throw new Error('单条笔记最多添加 10 个标签。');
    const existingTagIds = new Set(data.tags.map(({ id }) => id));
    if (requestedTagIds.some((id) => !existingTagIds.has(id))) throw new Error('标签不存在，请刷新后重试。');
    const categoryId = data.categories.some(({ id }) => id === input?.categoryId)
      ? input.categoryId
      : null;
    const timestamp = now();
    const noteId = createId();
    const attachments = images.length > 0
      ? await attachmentStorage.saveImages({ noteId, createdAt: timestamp, images })
      : [];
    const note = {
      id: noteId,
      title: content.slice(0, 20),
      content,
      categoryId,
      tagIds: requestedTagIds,
      stockName: input?.stockName?.trim() || null,
      stockCode: input?.stockCode?.trim() || null,
      attachmentIds: attachments.map(({ id }) => id),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    data.notes.push(note);
    data.attachments.push(...attachments);
    try {
      await storage.writeData(data);
    } catch (error) {
      if (attachments.length > 0) {
        try {
          await attachmentStorage.removeNoteDirectory(path.dirname(attachments[0].filePath));
        } catch {
          // Preserve the JSON write error that explains why the save failed.
        }
      }
      throw error;
    }
    return note;
  }

  async function getAttachments(ids = []) {
    const data = await storage.readData();
    const byId = new Map(data.attachments.map((attachment) => [attachment.id, attachment]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  function validateTags(data, tagIds) {
    const requestedTagIds = [...new Set(Array.isArray(tagIds) ? tagIds : [])];
    if (requestedTagIds.length > 10) throw new Error('单条笔记最多添加 10 个标签。');
    const existingTagIds = new Set(data.tags.map(({ id }) => id));
    if (requestedTagIds.some((id) => !existingTagIds.has(id))) {
      throw new Error('标签不存在，请刷新后重试。');
    }
    return requestedTagIds;
  }

  async function updateNote(id, input) {
    const data = await storage.readData();
    const note = data.notes.find((item) => item.id === id);
    if (!note) throw new Error('笔记不存在，请刷新后重试。');

    const images = Array.isArray(input?.images) ? input.images : [];
    const removeIds = new Set(Array.isArray(input?.removeAttachmentIds) ? input.removeAttachmentIds : []);
    const currentAttachments = data.attachments.filter((item) => note.attachmentIds.includes(item.id));
    const removedAttachments = currentAttachments.filter((item) => removeIds.has(item.id));
    const retainedAttachments = currentAttachments.filter((item) => !removeIds.has(item.id));
    if (retainedAttachments.length + images.length > 10) {
      throw new Error('单条笔记最多添加 10 张图片。');
    }
    if (images.length > 0 && !attachmentStorage) throw new Error('图片附件存储不可用。');

    const title = input?.title?.trim() || null;
    const content = input?.content?.trim() || '';
    if (!title && !content && retainedAttachments.length + images.length === 0) {
      throw new Error('标题、正文和图片不能同时为空。');
    }
    const categoryId = data.categories.some(({ id: existingCategoryId }) => (
      existingCategoryId === input?.categoryId
    )) ? input.categoryId : null;
    const tagIds = validateTags(data, input?.tagIds);
    const timestamp = now();
    const newAttachments = images.length > 0
      ? await attachmentStorage.saveImages({ noteId: note.id, createdAt: timestamp, images })
      : [];

    note.title = title;
    note.content = content;
    note.categoryId = categoryId;
    note.tagIds = tagIds;
    note.stockName = input?.stockName?.trim() || null;
    note.stockCode = input?.stockCode?.trim() || null;
    note.attachmentIds = [
      ...retainedAttachments.map(({ id: attachmentId }) => attachmentId),
      ...newAttachments.map(({ id: attachmentId }) => attachmentId),
    ];
    note.updatedAt = timestamp;
    data.attachments = data.attachments
      .filter((item) => !removedAttachments.some(({ id: removedId }) => removedId === item.id))
      .concat(newAttachments);

    try {
      await storage.writeData(data);
    } catch (error) {
      if (attachmentStorage?.removeAttachment) {
        await Promise.allSettled(newAttachments.map((attachment) => attachmentStorage.removeAttachment(attachment)));
      }
      throw error;
    }

    const cleanup = attachmentStorage?.removeAttachment
      ? await Promise.allSettled(removedAttachments.map((attachment) => attachmentStorage.removeAttachment(attachment)))
      : [];
    const failedCleanup = cleanup.filter(({ status }) => status === 'rejected').length;
    return {
      note,
      warnings: failedCleanup > 0
        ? [`笔记已保存，但有 ${failedCleanup} 个本地图片文件未能清理。`]
        : [],
    };
  }

  async function deleteNote(id) {
    const data = await storage.readData();
    const noteIndex = data.notes.findIndex((item) => item.id === id);
    if (noteIndex < 0) throw new Error('笔记不存在，请刷新后重试。');
    const [note] = data.notes.splice(noteIndex, 1);
    const noteAttachments = data.attachments.filter((item) => note.attachmentIds.includes(item.id));
    data.attachments = data.attachments.filter((item) => !note.attachmentIds.includes(item.id));
    await storage.writeData(data);

    const cleanup = attachmentStorage?.removeAttachment
      ? await Promise.allSettled(noteAttachments.map((attachment) => attachmentStorage.removeAttachment(attachment)))
      : [];
    const failedCleanup = cleanup.filter(({ status }) => status === 'rejected').length;
    return {
      note,
      warnings: failedCleanup > 0
        ? [`笔记已删除，但有 ${failedCleanup} 个本地图片文件未能清理。`]
        : [],
    };
  }

  async function getCategories() {
    const data = await storage.readData();
    return data.categories.slice().sort((left, right) => left.sortOrder - right.sortOrder);
  }

  async function createCategory(input) {
    const data = await storage.readData();
    const name = cleanName(input?.name, '分类');
    assertUnique(data.categories, name, '分类');
    const timestamp = now();
    const category = {
      id: createId(), name, color: input?.color || null,
      sortOrder: data.categories.reduce((max, item) => Math.max(max, item.sortOrder ?? -1), -1) + 1,
      createdAt: timestamp, updatedAt: timestamp,
    };
    data.categories.push(category);
    await storage.writeData(data);
    return category;
  }

  async function updateCategory(id, input) {
    const data = await storage.readData();
    const category = data.categories.find((item) => item.id === id);
    if (!category) throw new Error('分类不存在。');
    const name = cleanName(input?.name, '分类');
    assertUnique(data.categories, name, '分类', id);
    category.name = name;
    category.updatedAt = now();
    await storage.writeData(data);
    return category;
  }

  async function deleteCategory(id) {
    const data = await storage.readData();
    if (data.notes.some((note) => note.categoryId === id)) throw new Error('已有笔记使用该分类，不能删除。');
    const index = data.categories.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('分类不存在。');
    const [deleted] = data.categories.splice(index, 1);
    await storage.writeData(data);
    return deleted;
  }

  async function getTags() {
    const data = await storage.readData();
    const counts = new Map();
    for (const note of data.notes) {
      for (const id of new Set(Array.isArray(note.tagIds) ? note.tagIds : [])) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
    return data.tags
      .map((tag) => ({ ...tag, usageCount: counts.get(tag.id) || 0 }))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async function createTag(input) {
    const data = await storage.readData();
    const name = cleanName(input?.name, '标签');
    assertUnique(data.tags, name, '标签');
    const timestamp = now();
    const tag = { id: createId(), name, usageCount: 0, createdAt: timestamp, updatedAt: timestamp };
    data.tags.push(tag);
    await storage.writeData(data);
    return tag;
  }

  async function updateTag(id, input) {
    const data = await storage.readData();
    const tag = data.tags.find((item) => item.id === id);
    if (!tag) throw new Error('标签不存在。');
    const name = cleanName(input?.name, '标签');
    assertUnique(data.tags, name, '标签', id);
    tag.name = name;
    tag.updatedAt = now();
    await storage.writeData(data);
    return tag;
  }

  async function deleteTag(id) {
    const data = await storage.readData();
    if (data.notes.some((note) => Array.isArray(note.tagIds) && note.tagIds.includes(id))) {
      throw new Error('已有笔记使用该标签，不能删除。');
    }
    const index = data.tags.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('标签不存在。');
    const [deleted] = data.tags.splice(index, 1);
    await storage.writeData(data);
    return deleted;
  }

  return {
    initStorage,
    getAllNotes,
    createNote,
    updateNote,
    deleteNote,
    getAttachments,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getTags,
    createTag,
    updateTag,
    deleteTag,
    ensureDefaultCategories,
  };
}

module.exports = { DEFAULT_CATEGORY_NAMES, createNotesRepository };
