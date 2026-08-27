'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-ailog-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/ai');
  await page.click('button:has-text("记录一次")');
  await waitFor(() => page.$('.form-modal'));
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('记录一次弹窗字段按上下顺序展示：日期/用途/工具/做了什么/结果与心得', async () => {
  const labels = await page.$$eval('.form-modal .fr-label', (ns) => ns.map((n) => n.textContent.trim()));
  assert.deepStrictEqual(labels, ['日期', '用途', '工具', '做了什么', '结果与心得'], '顺序: ' + labels.join(','));
});

test('控件对齐：每行都有标签和控件，弹窗宽度适配', async () => {
  const rows = await page.$$eval('.form-modal .form-row', (ns) => ns.map((n) => ({
    label: !!n.querySelector('.fr-label'),
    ctl: !!n.querySelector('.fr-ctl input, .fr-ctl select, .fr-ctl textarea'),
  })));
  assert.strictEqual(rows.length, 5, '应有 5 行');
  for (const r of rows) assert.ok(r.label && r.ctl, '每行都应有标签和控件');
  const w = await page.$eval('.form-modal', (n) => n.getBoundingClientRect().width);
  assert.ok(w <= 520 && w > 300, '弹窗宽度应适中: ' + w);
});

test('仍可正常保存一条日志', async () => {
  await page.selectOption('.form-modal select', '写文案');
  await page.fill('.form-modal input[type="text"]', 'ChatGPT');
  const areas = await page.$$('.form-modal textarea');
  await areas[0].fill('写一条文案');
  await areas[1].fill('效果不错');
  await page.click('.form-modal .btn-primary');
  await waitFor(() => page.$eval('.item-card', (n) => n.textContent.includes('写一条文案')));
});
