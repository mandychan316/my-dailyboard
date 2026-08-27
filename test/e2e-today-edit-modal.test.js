'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-tmodal-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/today');
  // 先加一条任务
  await page.fill('#task-text', '需要编辑的任务');
  await page.click('button:has-text("添加")');
  await waitFor(() => page.$('.task-item'));
  // 打开编辑弹窗
  const btns = await page.$$('.task-item .task-actions button');
  await btns[0].click();
  await waitFor(() => page.$('.form-modal'));
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('编辑弹窗只有 内容/优先级/备注，顺序正确且无时间', async () => {
  const labels = await page.$$eval('.form-modal .fr-label', (ns) => ns.map((n) => n.textContent.trim()));
  assert.deepStrictEqual(labels, ['内容', '优先级', '备注'], '字段顺序: ' + labels.join(','));
  const hasTime = await page.$('.form-modal input[type="time"]');
  assert.strictEqual(hasTime, null, '不应有时间输入');
});

test('控件对齐：每行都有标签和控件', async () => {
  const rows = await page.$$eval('.form-modal .form-row', (ns) => ns.map((n) => ({
    label: !!n.querySelector('.fr-label'),
    ctl: !!n.querySelector('.fr-ctl input, .fr-ctl select, .fr-ctl textarea'),
  })));
  assert.strictEqual(rows.length, 3, '应有 3 行');
  for (const r of rows) {
    assert.ok(r.label && r.ctl, '每行都应有标签和控件: ' + JSON.stringify(r));
  }
});

test('弹窗宽度适配（不超过 520px）', async () => {
  const w = await page.$eval('.form-modal', (n) => n.getBoundingClientRect().width);
  assert.ok(w <= 520 && w > 300, '弹窗宽度应适中: ' + w);
});

test('编辑保存生效', async () => {
  const input = await page.$('.form-modal input[type="text"]');
  await input.fill('编辑后的任务');
  await page.click('.form-modal .btn-primary');
  await waitFor(() => page.$eval('.task-item', (n) => n.textContent.includes('编辑后的任务')));
});
