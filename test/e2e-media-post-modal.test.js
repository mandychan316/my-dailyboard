'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-mpm-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/media');
  await page.click('.tab:has-text("内容管理")');
  await waitFor(() => page.$('button:has-text("新增内容")'));
  await page.click('button:has-text("新增内容")');
  await waitFor(() => page.$('.form-modal'));
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('编辑内容弹窗按顺序展示：标题/内容、平台、状态、链接、发布日期、备注', async () => {
  const labels = await page.$$eval('.form-modal .fr-label', (ns) => ns.map((n) => n.textContent.trim()));
  assert.deepStrictEqual(labels, ['标题 / 内容', '平台', '状态', '链接', '发布日期', '备注'], '顺序: ' + labels.join(','));
});

test('控件对齐：每行都有标签和控件，弹窗宽度适配', async () => {
  const rows = await page.$$eval('.form-modal .form-row', (ns) => ns.map((n) => ({
    label: !!n.querySelector('.fr-label'),
    ctl: !!n.querySelector('.fr-ctl input, .fr-ctl select, .fr-ctl textarea'),
  })));
  assert.strictEqual(rows.length, 6, '应有 6 行');
  for (const r of rows) assert.ok(r.label && r.ctl, '每行都应有标签和控件');
  const w = await page.$eval('.form-modal', (n) => n.getBoundingClientRect().width);
  assert.ok(w <= 520 && w > 300, '弹窗宽度应适中: ' + w);
});

test('按新顺序填写并保存一条内容', async () => {
  const inputs = await page.$$('.form-modal input[type="text"]');
  await inputs[0].fill('新的小红书选题'); // 标题
  await page.selectOption('.form-modal select', '小红书'); // 平台（第一个 select）
  const selects = await page.$$('.form-modal select');
  await selects[1].selectOption('ready'); // 状态
  await inputs[1].fill('https://example.com/post'); // 链接
  await page.fill('.form-modal input[type="date"]', '2026-08-30'); // 发布日期
  await inputs[2].fill('记得配图'); // 备注
  await page.click('.form-modal .btn-primary');
  await waitFor(() => page.$eval('.item-card', (n) => n.textContent.includes('新的小红书选题')));
  const text = await page.textContent('.item-card');
  assert.ok(text.includes('小红书'));
  assert.ok(text.includes('2026-08-30'));
  assert.ok(text.includes('记得配图'));
  const advance = await page.$('.item-card button:has-text("推进")');
  assert.ok(advance, '待发布内容应有推进按钮');
  const href = await page.$eval('.item-card a[href]', (n) => n.getAttribute('href'));
  assert.strictEqual(href, 'https://example.com/post', '链接应保存');
});
