const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: 1,
  theme: 'light',
  floatingShortcut: 'Alt+J',
  defaultCategoryId: null,
  onboardingDismissed: false,
});

function normalize(value = {}, categoryIds) {
  const category = typeof value.defaultCategoryId === 'string' ? value.defaultCategoryId : null;
  return {
    schemaVersion: 1,
    theme: ['light', 'dark', 'system'].includes(value.theme) ? value.theme : 'light',
    floatingShortcut: typeof value.floatingShortcut === 'string' && value.floatingShortcut.trim()
      ? value.floatingShortcut.trim() : 'Alt+J',
    defaultCategoryId: category && (!categoryIds || categoryIds.includes(category)) ? category : null,
    onboardingDismissed: value.onboardingDismissed === true,
  };
}

function createSettingsService({ dataDirectory, fileSystem = fs }) {
  const settingsFilePath = path.join(dataDirectory, 'settings.json');
  async function write(settings) {
    const target = normalize(settings);
    const temporary = `${settingsFilePath}.tmp-${randomUUID()}`;
    await fileSystem.mkdir(dataDirectory, { recursive: true });
    try {
      await fileSystem.writeFile(temporary, `${JSON.stringify(target, null, 2)}\n`, 'utf8');
      await fileSystem.rename(temporary, settingsFilePath);
    } catch (error) {
      await fileSystem.rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
    return target;
  }
  async function getSettings(categoryIds) {
    try {
      const parsed = JSON.parse(await fileSystem.readFile(settingsFilePath, 'utf8'));
      return normalize(parsed, categoryIds);
    } catch (error) {
      if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      return write(DEFAULT_SETTINGS);
    }
  }
  async function updateSettings(patch) {
    return write({ ...(await getSettings()), ...patch });
  }
  return { settingsFilePath, getSettings, updateSettings, replaceSettings: write };
}

module.exports = { createSettingsService, DEFAULT_SETTINGS, normalizeSettings: normalize };
