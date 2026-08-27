'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-home-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/home');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('侧边导航包含 6 个板块 + 设置', async () => {
  const items = await page.$$eval('#nav .nav-item, .sidebar-foot .nav-item', (nodes) => nodes.map((n) => n.textContent.trim()));
  for (const expected of ['首页总览', '今日计划', 'AI实践', '自媒体', '运动计划', '饮食计划', '设置与备份']) {
    assert.ok(items.some((t) => t.includes(expected)), '缺少导航项: ' + expected);
  }
});

test('首页显示今天日期', async () => {
  const dateText = await page.textContent('.home-hero .date-big');
  const today = new Date();
  const expectMonth = today.getMonth() + 1 + '月' + today.getDate() + '日';
  assert.ok(dateText.includes(expectMonth), '日期不符: ' + dateText);
});

test('今日路线包含 5 个站点', async () => {
  const names = await page.$$eval('.station .st-name', (nodes) => nodes.map((n) => n.textContent.trim()));
  assert.deepStrictEqual(names, ['今日计划', '三餐', '运动', 'AI实践', '自媒体']);
});

test('点击站点跳转到对应模块', async () => {
  const station = await page.$('.station');
  const name = await station.textContent();
  await station.click();
  await waitFor(() => page.evaluate(() => location.hash));
  const hash = await page.evaluate(() => location.hash);
  assert.ok(['#/today', '#/diet', '#/exercise', '#/ai', '#/media'].includes(hash), name + ' 跳转异常: ' + hash);
  // 回到首页
  await page.goto(base + '/#/home');
});

test('快捷备忘：新增后显示，刷新后仍在', async () => {
  const input = await page.$('#memo-input');
  await input.fill('今天要买瑜伽垫');
  await input.press('Enter');
  await waitFor(() => page.$$eval('.memo-item .memo-text', (ns) => ns.some((n) => n.textContent.includes('今天要买瑜伽垫'))));
  // 等待自动保存落盘
  await waitFor(async () => {
    const r = await fetch(base + '/api/data');
    const j = await r.json();
    return j.notes.notes.some((n) => n.text === '今天要买瑜伽垫');
  });
  await page.reload();
  await waitFor(() => page.$$eval('.memo-item .memo-text', (ns) => ns.some((n) => n.textContent.includes('今天要买瑜伽垫'))));
  const shown = await page.$$eval('.memo-item .memo-text', (ns) => ns.map((n) => n.textContent));
  assert.ok(shown.some((t) => t.includes('今天要买瑜伽垫')));
});

test('删除备忘需要二次确认，确认后消失', async () => {
  await page.goto(base + '/#/home');
  await waitFor(() => page.$('.memo-item .btn'));
  // 先点删除但取消
  await page.click('.memo-item .btn');
  await waitFor(() => page.$('.modal'));
  await page.click('.modal-actions .btn:not(.btn-danger)'); // 取消
  await waitFor(() => page.$$eval('.memo-item .memo-text', (ns) => ns.some((n) => n.textContent.includes('今天要买瑜伽垫'))));
  // 再删除并确认
  await page.click('.memo-item .btn');
  await waitFor(() => page.$('.modal'));
  await page.click('.modal-actions .btn-danger');
  await waitFor(() => page.$$eval('.memo-item', (ns) => ns.length === 0));
  const count = await page.$$eval('.memo-item', (ns) => ns.length);
  assert.strictEqual(count, 0);
});
