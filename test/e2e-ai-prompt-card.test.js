'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-aipc-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  await fetch(base + '/api/data/ai', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      logs: [],
      prompts: [{ id: 'p1', category: '写作', title: '周报助手', content: '把以下内容整理成一份周报', scene: '每周五', effect: '输出稳定', createdAt: '2026-08-01T00:00:00.000Z' }],
    }),
  });
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/ai');
  await page.click('.tab:has-text("提示词库")');
  await waitFor(() => page.$('.item-card'));
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('第一层展示 分类/场景/效果', async () => {
  const meta = await page.textContent('.item-card .ic-meta');
  assert.ok(meta.includes('写作'), '分类: ' + meta);
  assert.ok(meta.includes('场景：每周五'), '场景: ' + meta);
  assert.ok(meta.includes('效果：输出稳定'), '效果: ' + meta);
});

test('第二层标题、第三层提示词内容，顺序正确', async () => {
  const title = await page.textContent('.item-card .ic-title');
  assert.strictEqual(title, '周报助手');
  const body = await page.textContent('.item-card .ic-body');
  assert.ok(body.includes('把以下内容整理成一份周报'));
  const order = await page.$eval('.item-card', (n) => {
    const meta = n.querySelector('.ic-meta');
    const t = n.querySelector('.ic-title');
    const b = n.querySelector('.ic-body');
    return {
      metaBeforeTitle: !!(meta.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING),
      titleBeforeBody: !!(t.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  assert.ok(order.metaBeforeTitle, '第一层应在第二层之前');
  assert.ok(order.titleBeforeBody, '第二层应在第三层之前');
});
