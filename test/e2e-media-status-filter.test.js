'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const Dates = require('../public/js/dates.js');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-mst-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  await fetch(base + '/api/data/media', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ideas: [{ id: 'i1', text: '一个灵感', platform: '小红书', status: 'idea', createdAt: '2026-08-01T00:00:00.000Z' }],
      posts: [
        { id: 'p1', platform: '小红书', title: '撰写中的内容', status: 'writing', link: '', publishDate: '', note: '', createdAt: '2026-08-01T01:00:00.000Z' },
        { id: 'p2', platform: '抖音', title: '待发布的内容', status: 'ready', link: '', publishDate: '', note: '', createdAt: '2026-08-01T02:00:00.000Z' },
        { id: 'p3', platform: '公众号', title: '已发布的内容', status: 'published', link: '', publishDate: Dates.todayStr(), note: '', createdAt: '2026-08-01T03:00:00.000Z' },
      ],
    }),
  });
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/media');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('内容管理有状态选择框（全部状态/灵感/撰写/待发布/已发布）', async () => {
  await page.click('.tab:has-text("内容管理")');
  await waitFor(() => page.$('#post-status-filter'));
  const opts = await page.$$eval('#post-status-filter option', (ns) => ns.map((n) => n.textContent.trim()));
  assert.deepStrictEqual(opts, ['全部状态', '灵感', '撰写', '待发布', '已发布'], '状态选项: ' + opts.join(','));
  // 初始应显示全部 3 条内容
  const count = await page.$$eval('.item-card', (ns) => ns.length);
  assert.strictEqual(count, 3, '初始应显示全部内容');
});

test('按状态筛选：待发布只显示待发布内容', async () => {
  await page.selectOption('#post-status-filter', 'ready');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 1));
  const text = await page.textContent('.item-card');
  assert.ok(text.includes('待发布的内容'));
  assert.ok(!text.includes('撰写中的内容'));
  await page.selectOption('#post-status-filter', 'all');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 3));
});

test('点击顶部「待发布」统计卡：跳转内容管理并自动筛选待发布', async () => {
  await page.click('.stat-card:has-text("待发布")');
  await waitFor(() => page.$eval('.tab.active', (n) => n.textContent.includes('内容管理')));
  const statusVal = await page.$eval('#post-status-filter', (n) => n.value);
  assert.strictEqual(statusVal, 'ready', '状态筛选应为待发布');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 1));
  const text = await page.textContent('.item-card');
  assert.ok(text.includes('待发布的内容'));
});

test('点击「撰写中」统计卡：筛选撰写中', async () => {
  await page.click('.stat-card:has-text("撰写中")');
  await waitFor(() => page.$eval('#post-status-filter', (n) => n.value === 'writing'));
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 1));
  const text = await page.textContent('.item-card');
  assert.ok(text.includes('撰写中的内容'));
});

test('点击「灵感」统计卡：跳转到灵感库', async () => {
  await page.click('.stat-card:has-text("灵感")');
  await waitFor(() => page.$eval('.tab.active', (n) => n.textContent.includes('灵感库')));
  await waitFor(() => page.$eval('.item-card', (n) => n.textContent.includes('一个灵感')));
});
