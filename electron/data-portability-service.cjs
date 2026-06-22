const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

function sanitizeFileName(value) {
  return (value || '未命名').replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_').replace(/[. ]+$/g, '').slice(0, 80) || '未命名';
}

function stamp(now) {
  return now().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

function isInside(parent, target) {
  const relative = path.relative(path.resolve(parent), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function createUniqueDirectory(fileSystem, parent, name) {
  await fileSystem.mkdir(parent, { recursive: true });
  for (let index = 1; ; index += 1) {
    const target = path.join(parent, index === 1 ? name : `${name}-${index}`);
    try {
      await fileSystem.mkdir(target);
      return target;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
}

async function copyExportAttachments(fileSystem, attachments, directory, relativePrefix, allowedSourceRoot) {
  const mapped = [];
  for (const item of attachments) {
    if (!isInside(allowedSourceRoot, item.filePath)) throw new Error('附件路径不在本地数据目录中。');
    const folder = `note_${sanitizeFileName(item.noteId)}`;
    const fileName = sanitizeFileName(item.fileName);
    const target = path.join(directory, folder, fileName);
    await fileSystem.mkdir(path.dirname(target), { recursive: true });
    await fileSystem.copyFile(item.filePath, target);
    mapped.push({ ...item, fileName, filePath: path.posix.join(relativePrefix, folder, fileName) });
  }
  return mapped;
}

function createDataPortabilityService({ dataDirectory, fileSystem = fs, now = () => new Date() }) {
  const attachmentsDirectory = path.join(dataDirectory, 'attachments');

  async function exportMarkdown(parent, data) {
    const root = await createUniqueDirectory(fileSystem, parent, `export-markdown-${stamp(now)}`);
    await fileSystem.mkdir(path.join(root, 'notes'));
    const names = new Set();
    for (const note of data.notes) {
      let base = `${note.createdAt.slice(0, 10)}-${sanitizeFileName(note.title || note.content.slice(0, 20))}`;
      let name = base;
      let index = 2;
      while (names.has(name)) name = `${base}-${index++}`;
      names.add(name);
      const category = data.categories.find(({ id }) => id === note.categoryId)?.name || '未分类';
      const tags = note.tagIds.map((id) => data.tags.find((tag) => tag.id === id)?.name).filter(Boolean).join('、') || '无';
      const items = data.attachments.filter(({ id }) => note.attachmentIds.includes(id));
      const copied = await copyExportAttachments(fileSystem, items, path.join(root, 'attachments'), '../attachments', attachmentsDirectory);
      const images = copied.map((item) => `![${item.fileName}](${item.filePath})`).join('\n\n');
      const body = `# ${note.title || '未命名笔记'}\n\n- 创建时间：${note.createdAt}\n- 更新时间：${note.updatedAt}\n- 分类：${category}\n- 标签：${tags}\n- 股票名称：${note.stockName || '无'}\n- 股票代码：${note.stockCode || '无'}\n\n${note.content}\n${images ? `\n${images}\n` : ''}`;
      await fileSystem.writeFile(path.join(root, 'notes', `${name}.md`), body, 'utf8');
    }
    return root;
  }

  async function exportJson(parent, data, settings) {
    const root = await createUniqueDirectory(fileSystem, parent, `export-json-${stamp(now)}`);
    const attachments = await copyExportAttachments(fileSystem, data.attachments, path.join(root, 'attachments'), 'attachments', attachmentsDirectory);
    await fileSystem.writeFile(path.join(root, 'data.json'), JSON.stringify({ ...data, attachments, settings }, null, 2), 'utf8');
    return root;
  }

  function portableAttachment(item) {
    if (!isInside(attachmentsDirectory, item.filePath)) throw new Error('附件路径不在本地数据目录中。');
    const relative = path.relative(attachmentsDirectory, item.filePath).split(path.sep).join('/');
    return { ...item, filePath: path.posix.join('attachments', relative) };
  }

  async function backup(parent) {
    const root = await createUniqueDirectory(fileSystem, parent, `backup-${stamp(now)}`);
    const notes = JSON.parse(await fileSystem.readFile(path.join(dataDirectory, 'notes.json'), 'utf8'));
    notes.attachments = notes.attachments.map(portableAttachment);
    await fileSystem.writeFile(path.join(root, 'notes.json'), `${JSON.stringify(notes, null, 2)}\n`, 'utf8');
    await fileSystem.copyFile(path.join(dataDirectory, 'settings.json'), path.join(root, 'settings.json'));
    await fileSystem.cp(attachmentsDirectory, path.join(root, 'attachments'), { recursive: true, force: true }).catch(async (error) => {
      if (error?.code === 'ENOENT') await fileSystem.mkdir(path.join(root, 'attachments'));
      else throw error;
    });
    return root;
  }

  async function validateBackup(root) {
    try {
      const notes = JSON.parse(await fileSystem.readFile(path.join(root, 'notes.json'), 'utf8'));
      const settings = JSON.parse(await fileSystem.readFile(path.join(root, 'settings.json'), 'utf8'));
      const requiredArrays = ['notes', 'categories', 'tags', 'attachments'];
      if (notes.schemaVersion !== 2 || !requiredArrays.every((key) => Array.isArray(notes[key])) || settings?.schemaVersion !== 1) {
        throw new Error('invalid structure');
      }
      const attachmentIds = new Set(notes.attachments.map(({ id }) => id));
      const noteIds = new Set(notes.notes.map(({ id }) => id));
      const categoryIds = new Set(notes.categories.map(({ id }) => id));
      const tagIds = new Set(notes.tags.map(({ id }) => id));
      if (attachmentIds.size !== notes.attachments.length || noteIds.size !== notes.notes.length
        || categoryIds.size !== notes.categories.length || tagIds.size !== notes.tags.length) {
        throw new Error('duplicate ids');
      }
      if (notes.notes.some((note) => !Array.isArray(note.attachmentIds)
        || !Array.isArray(note.tagIds)
        || (note.categoryId != null && !categoryIds.has(note.categoryId))
        || note.tagIds.some((id) => !tagIds.has(id))
        || note.attachmentIds.some((id) => !attachmentIds.has(id)))) {
        throw new Error('invalid note references');
      }
      if (notes.attachments.some(({ noteId }) => !noteIds.has(noteId))) {
        throw new Error('invalid attachment owner');
      }
      const backupAttachments = path.join(root, 'attachments');
      if (!(await fileSystem.stat(backupAttachments)).isDirectory()) throw new Error('missing attachments directory');
      for (const attachment of notes.attachments) {
        if (typeof attachment.filePath !== 'string' || !attachment.filePath.replace(/\\/g, '/').startsWith('attachments/')) throw new Error('invalid attachment path');
        const source = path.resolve(root, ...attachment.filePath.replace(/\\/g, '/').split('/'));
        if (!isInside(backupAttachments, source)) throw new Error('unsafe attachment path');
        await fileSystem.access(source);
      }
      return { notes, settings };
    } catch (error) {
      if (error?.message === '备份格式不正确。') throw error;
      throw new Error('备份格式不正确。', { cause: error });
    }
  }

  async function restore(root) {
    const validated = await validateBackup(root);
    const parent = path.dirname(dataDirectory);
    const stage = path.join(parent, `${path.basename(dataDirectory)}.restore-${randomUUID()}`);
    const previous = path.join(parent, `${path.basename(dataDirectory)}.previous-${randomUUID()}`);
    const safetyBackupPath = await backup(parent);
    try {
      await fileSystem.mkdir(stage);
      await fileSystem.cp(path.join(root, 'attachments'), path.join(stage, 'attachments'), { recursive: true });
      const rebased = {
        ...validated.notes,
        attachments: validated.notes.attachments.map((item) => {
          const relative = item.filePath.replace(/\\/g, '/').slice('attachments/'.length).split('/');
          return { ...item, filePath: path.join(dataDirectory, 'attachments', ...relative) };
        }),
      };
      await fileSystem.writeFile(path.join(stage, 'notes.json'), `${JSON.stringify(rebased, null, 2)}\n`, 'utf8');
      await fileSystem.writeFile(path.join(stage, 'settings.json'), `${JSON.stringify(validated.settings, null, 2)}\n`, 'utf8');
    } catch (error) {
      await fileSystem.rm(stage, { recursive: true, force: true }).catch(() => undefined);
      throw new Error('恢复失败，原数据已保留。', { cause: error });
    }

    try {
      await fileSystem.rename(dataDirectory, previous);
      try {
        await fileSystem.rename(stage, dataDirectory);
      } catch (error) {
        await fileSystem.rename(previous, dataDirectory);
        throw error;
      }
    } catch (error) {
      await fileSystem.rm(stage, { recursive: true, force: true }).catch(() => undefined);
      throw new Error('恢复失败，原数据已保留。', { cause: error });
    }
    await fileSystem.rm(previous, { recursive: true, force: true }).catch(() => undefined);
    return { safetyBackupPath };
  }

  return { exportMarkdown, exportJson, backup, validateBackup, restore };
}

module.exports = { createDataPortabilityService, sanitizeFileName };
