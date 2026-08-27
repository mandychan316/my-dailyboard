'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-mlay-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  await fetch(base + '/api/data/media', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ideas: [],
      posts: [
        { id: 'p1', platform: '小红书', title: '带链接的标题', status: 'ready', link: 'https://example.com/abc', publishDate: '2026-08-30', note: '备注内容', createdAt: '2026-08-01T01:00:00.000Z' },
        { id: 'p2', platform: '抖音', title: '没有链接的标题', status: 'writing', link: '', publishDate: '', note: '', createdAt: '2026-08-01T02:00:00.000Z' },
      ],
    }),
  });
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/media');
  await page.click('.tab:has-text("内容管理")');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 2));
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('第一层展示平台/状态/发布日期', async () => {
  const first = page.locator('.item-card').filter({ hasText: '带链接的标题' });
  const meta = await first.locator('.ic-meta').innerText();
  assert.ok(meta.includes('小红书'), '平台: ' + meta);
  assert.ok(meta.includes('待发布'), '状态: ' + meta);
  assert.ok(meta.includes('发布于 2026-08-30'), '发布日期: ' + meta);
});

test('第二层标题有链接时可点击跳转，无链接则为普通文本', async () => {
  const withLink = page.locator('.item-card').filter({ hasText: '带链接的标题' });
  const a = withLink.locator('a.ic-link');
  await a.waitFor();
  assert.strictEqual(await a.getAttribute('href'), 'https://example.com/abc');
  assert.strictEqual(await a.getAttribute('target'), '_blank');
  assert.strictEqual(await a.innerText(), '带链接的标题');

  const noLink = page.locator('.item-card').filter({ hasText: '没有链接的标题' });
  const titleDiv = noLink.locator('.ic-title');
  await titleDiv.waitFor();
  assert.strictEqual(await titleDiv.evaluate((n) => n.tagName), 'DIV', '无链接时标题应是普通文本');
});

test('第三层展示备注，且层级顺序为 第一层→第二层→第三层', async () => {
  const card = page.locator('.item-card').filter({ hasText: '带链接的标题' });
  const note = card.locator('.ic-note');
  await note.waitFor();
  assert.strictEqual(await note.innerText(), '备注内容');
  // DOM 顺序：ic-meta(第一层) < a.ic-title(第二层) < ic-note(第三层)
  const order = await card.evaluate((n) => {
    const meta = n.querySelector('.ic-meta');
    const title = n.querySelector('.ic-title');
    const noteEl = n.querySelector('.ic-note');
    return {
      metaBeforeTitle: meta.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING ? true : false,
      titleBeforeNote: title.compareDocumentPosition(noteEl) & Node.DOCUMENT_POSITION_FOLLOWING ? true : false,
    };
  });
  assert.ok(order.metaBeforeTitle, '第一层应在第二层之前');
  assert.ok(order.titleBeforeNote, '第二层应在第三层之前');
});
