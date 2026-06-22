const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

let mainWindow;
let floatingWindow;

async function capture(window, filename) {
  await new Promise((resolve) => setTimeout(resolve, 180));
  const image = await window.capturePage();
  await fs.writeFile(path.join(__dirname, '..', 'assets', filename), image.toPNG());
}

async function waitFor(window, expression) {
  await window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const check = () => {
        if (${expression}) return requestAnimationFrame(() => requestAnimationFrame(resolve));
        if (Date.now() - startedAt > 3000) return reject(new Error('Renderer wait timed out'));
        setTimeout(check, 25);
      };
      check();
    })
  `);
}

async function run() {
  await app.whenReady();
  const renderer = path.join(__dirname, '..', 'dist', 'index.html');
  const webPreferences = { contextIsolation: true, nodeIntegration: false };
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    show: true,
    webPreferences,
  });
  await mainWindow.loadFile(renderer);
  await waitFor(mainWindow, "document.querySelector('[data-testid=\"app-shell\"]')");
  await mainWindow.webContents.executeJavaScript(`
    window.desktop = {
      getAllNotes: async () => [{
        id: 'qa-note', title: '放量突破后的承接观察',
        content: '突破发生后，重点记录量能变化、回踩位置与承接力度。',
        categoryId: 'qa-category', tagIds: ['qa-tag'],
        stockName: '示例股票', stockCode: '600000', attachmentIds: [],
        createdAt: '2026-06-21T08:00:00.000Z', updatedAt: '2026-06-21T09:30:00.000Z'
      }, {
        id: 'qa-note-2', title: null, content: '未分类的盘后复盘记录。',
        categoryId: null, tagIds: [], stockName: null, stockCode: null, attachmentIds: [],
        createdAt: '2026-06-20T08:00:00.000Z', updatedAt: '2026-06-20T08:00:00.000Z'
      }],
      getCategories: async () => [{
        id: 'qa-category', name: 'K线知识', color: null, sortOrder: 0,
        createdAt: '2026-06-21T08:00:00.000Z', updatedAt: '2026-06-21T08:00:00.000Z'
      }],
      getTags: async () => [{
        id: 'qa-tag', name: '突破', usageCount: 1,
        createdAt: '2026-06-21T08:00:00.000Z', updatedAt: '2026-06-21T08:00:00.000Z'
      }],
      getAttachments: async () => [],
      onNotesChanged: () => () => {},
      readAttachment: async () => { throw new Error('No QA attachment'); },
      updateNote: async () => { throw new Error('Not used in visual smoke'); },
      deleteNote: async () => { throw new Error('Not used in visual smoke'); }
    };
    [...document.querySelectorAll('.sidebar__nav-item')]
      .find((item) => item.textContent.includes('知识库'))?.click();
  `);
  await waitFor(mainWindow, "document.querySelector('.library-layout')");
  await capture(mainWindow, 'qa-library-light.png');
  await mainWindow.webContents.executeJavaScript(
    "document.querySelector('[aria-label=\"筛选\"]')?.click()",
  );
  await waitFor(mainWindow, "document.querySelector('.library-filter-panel')");
  await capture(mainWindow, 'qa-library-filter-light.png');
  await mainWindow.webContents.executeJavaScript(
    "document.querySelector('[aria-label=\"筛选\"]')?.click()",
  );
  await waitFor(mainWindow, "!document.querySelector('.library-filter-panel')");
  await mainWindow.webContents.executeJavaScript(
    "document.querySelector('[aria-label=\"切换到深色主题\"]')?.click()",
  );
  await waitFor(mainWindow, "document.querySelector('[data-testid=\"app-shell\"]')?.dataset.theme === 'dark'");
  await capture(mainWindow, 'qa-library-dark.png');

  floatingWindow = new BrowserWindow({
    width: 360,
    height: 420,
    backgroundColor: '#00000000',
    frame: false,
    show: true,
    transparent: true,
    webPreferences,
  });
  await floatingWindow.loadFile(renderer, { query: { window: 'floating' } });
  await waitFor(floatingWindow, "document.querySelector('.floating-card')");
  await capture(floatingWindow, 'qa-floating.png');
  await floatingWindow.webContents.executeJavaScript(
    "document.querySelector('[aria-label=\"折叠浮窗\"]')?.click()",
  );
  await waitFor(floatingWindow, "document.querySelector('[aria-label=\"展开笔记浮窗\"]')");
  floatingWindow.setSize(104, 52);
  await waitFor(floatingWindow, "document.querySelector('[aria-label=\"展开笔记浮窗\"]')");
  await capture(floatingWindow, 'qa-floating-mini.png');

  app.quit();
}

run().catch((error) => {
  console.error(error);
  app.exit(1);
});
