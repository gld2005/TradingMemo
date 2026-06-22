const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createSettingsService, DEFAULT_SETTINGS } = require('./settings-service.cjs');

test('creates, persists, and normalizes local settings', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'memo-settings-'));
  const service = createSettingsService({ dataDirectory: root });
  assert.deepEqual(await service.getSettings(), DEFAULT_SETTINGS);
  await service.updateSettings({ theme: 'dark', floatingShortcut: 'Ctrl+Shift+M', defaultCategoryId: 'c1' });
  assert.deepEqual(await createSettingsService({ dataDirectory: root }).getSettings(), {
    ...DEFAULT_SETTINGS, theme: 'dark', floatingShortcut: 'Ctrl+Shift+M', defaultCategoryId: 'c1',
  });
  await fs.writeFile(service.settingsFilePath, JSON.stringify({ theme: 'nope', floatingShortcut: '' }));
  assert.deepEqual(await service.getSettings(), DEFAULT_SETTINGS);
});

test('falls back when configured category no longer exists', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'memo-settings-'));
  const service = createSettingsService({ dataDirectory: root });
  await service.updateSettings({ defaultCategoryId: 'missing' });
  assert.equal((await service.getSettings(['available'])).defaultCategoryId, null);
});
