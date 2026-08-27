'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-ks-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/media');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('灵感库平台选项包含快手', async () => {
  const opts = await page.$$eval('#idea-platform option', (ns) => ns.map((n) => n.textContent.trim()));
  assert.ok(opts.includes('快手'), '平台选项应包含快手: ' + opts.join(','));
});

test('内容管理平台选项包含快手，且可新建快手内容', async () => {
  await page.click('.tab:has-text("内容管理")');
  await waitFor(() => page.$('button:has-text("新增内容")'));
  await page.click('button:has-text("新增内容")');
  await waitFor(() => page.$('.form-modal'));
  const opts = await page.$$eval('.form-modal select option', (ns) => ns.map((n) => n.textContent.trim()));
  assert.ok(opts.includes('快手'), '新增内容平台应包含快手');
  await page.selectOption('.form-modal select', '快手');
  const inputs = await page.$$('.form-modal input[type="text"]');
  await inputs[0].fill('快手短视频选题');
  await page.click('.form-modal .btn-primary');
  await waitFor(() => page.$eval('.item-card', (n) => n.textContent.includes('快手短视频选题')));
  const text = await page.textContent('.item-card');
  assert.ok(text.includes('快手'), '内容应显示平台快手');
});
