'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-aiprm-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/ai');
  await page.click('.tab:has-text("提示词库")');
  await waitFor(() => page.$('#prompt-category-filter'));
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('分类为下拉框，支持选择', async () => {
  const sel = await page.$('#prompt-category-filter');
  assert.ok(sel, '应有分类下拉框');
  const opts = await page.$$eval('#prompt-category-filter option', (ns) => ns.map((n) => n.textContent.trim()));
  assert.ok(opts.includes('全部分类'), '应有全部分类选项');
  assert.ok(opts.includes('写作'), '应有写作分类');
  const chips = await page.$$('.chip.cat');
  assert.strictEqual(chips.length, 0, '不应再使用分类标签按钮');
});

test('新增模板弹窗：顺序为 分类/标题/适用场景/效果/提示词内容，对齐且适配', async () => {
  await page.click('button:has-text("新增模板")');
  await waitFor(() => page.$('.form-modal'));
  const labels = await page.$$eval('.form-modal .fr-label', (ns) => ns.map((n) => n.textContent.trim()));
  assert.deepStrictEqual(labels, ['分类', '标题', '适用场景', '效果', '提示词内容'], '顺序: ' + labels.join(','));
  const rows = await page.$$eval('.form-modal .form-row', (ns) => ns.map((n) => ({
    label: !!n.querySelector('.fr-label'),
    ctl: !!n.querySelector('.fr-ctl input, .fr-ctl select, .fr-ctl textarea'),
  })));
  assert.strictEqual(rows.length, 5);
  for (const r of rows) assert.ok(r.label && r.ctl, '每行都应有标签和控件');
  const w = await page.$eval('.form-modal', (n) => n.getBoundingClientRect().width);
  assert.ok(w <= 520 && w > 300, '弹窗宽度应适中: ' + w);
  const resize = await page.$eval('.form-modal textarea', (n) => getComputedStyle(n).resize);
  assert.ok(resize === 'vertical' || resize === 'both', '提示词内容应可拖拽调整大小: ' + resize);
});

test('新增模板仍可正常保存', async () => {
  await page.selectOption('.form-modal select', '写作');
  const inputs = await page.$$('.form-modal input[type="text"]');
  await inputs[0].fill('周报总结助手');
  await inputs[1].fill('每周五');
  await inputs[2].fill('稳定输出');
  await page.fill('.form-modal textarea', '请把内容整理成周报');
  await page.click('.form-modal .btn-primary');
  await waitFor(() => page.$eval('.item-card', (n) => n.textContent.includes('周报总结助手')));
  const text = await page.textContent('.item-card');
  assert.ok(text.includes('每周五') && text.includes('稳定输出') && text.includes('整理成周报'));
});
