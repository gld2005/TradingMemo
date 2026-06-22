function registerNotesIpc({
  ipcMain,
  repository,
  attachmentStorage,
  dataFilePath,
  broadcastNotesChanged = () => undefined,
}) {
  ipcMain.handle('notes:get-all', () => repository.getAllNotes());
  ipcMain.handle('notes:create', async (_event, input) => {
    const note = await repository.createNote(input);
    broadcastNotesChanged();
    return note;
  });
  ipcMain.handle('notes:update', async (_event, id, input) => {
    const result = await repository.updateNote(id, input);
    broadcastNotesChanged();
    return result;
  });
  ipcMain.handle('notes:delete', async (_event, id) => {
    const result = await repository.deleteNote(id);
    broadcastNotesChanged();
    return result;
  });
  ipcMain.handle('categories:get', () => repository.getCategories());
  ipcMain.handle('categories:create', async (_event, input) => {
    const category = await repository.createCategory(input);
    broadcastNotesChanged();
    return category;
  });
  ipcMain.handle('categories:update', async (_event, id, input) => {
    const category = await repository.updateCategory(id, input);
    broadcastNotesChanged();
    return category;
  });
  ipcMain.handle('categories:delete', async (_event, id) => {
    const category = await repository.deleteCategory(id);
    broadcastNotesChanged();
    return category;
  });
  ipcMain.handle('tags:get', () => repository.getTags());
  ipcMain.handle('tags:create', async (_event, input) => {
    const tag = await repository.createTag(input);
    broadcastNotesChanged();
    return tag;
  });
  ipcMain.handle('tags:update', async (_event, id, input) => {
    const tag = await repository.updateTag(id, input);
    broadcastNotesChanged();
    return tag;
  });
  ipcMain.handle('tags:delete', async (_event, id) => {
    const tag = await repository.deleteTag(id);
    broadcastNotesChanged();
    return tag;
  });
  ipcMain.handle('attachments:get', (_event, ids) => repository.getAttachments(ids));
  ipcMain.handle('attachments:read', async (_event, id) => {
    const [attachment] = await repository.getAttachments([id]);
    if (!attachment) throw new Error('附件记录不存在。');
    return attachmentStorage.readAttachment(attachment);
  });
  ipcMain.handle('storage:get-info', () => ({ dataFilePath }));
}

module.exports = { registerNotesIpc };
