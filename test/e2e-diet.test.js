'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const Dates = require('../public/js/dates.js');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir, todayStr, weekDays;

before(async () => {
  dataDir = tempDataDir('wl-diet-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  todayStr = Dates.todayStr();
  weekDays = Dates.weekDays(todayStr);
  await page.goto(base + '/#/diet');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('本周表格显示 7 天，今天高亮', async () => {
  const heads = await page.$$eval('.diet-grid .dg-head', (ns) => ns.map((n) => n.textContent.trim()).filter((t) => t !== ''));
  assert.strictEqual(heads.length, 7, '应显示 7 天: ' + heads.join(','));
  const todayHead = await page.$('.diet-grid .dg-head.today');
  assert.ok(todayHead, '今天应高亮');
});

test('填写今天三餐并保存到数据文件', async () => {
  await page.fill('textarea[data-date="' + todayStr + '"][data-meal="breakfast"]', '燕麦牛奶 + 鸡蛋');
  await page.fill('textarea[data-date="' + todayStr + '"][data-meal="lunch"]', '糙米饭 + 西兰花鸡胸');
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    const m = j.diet.meals[todayStr];
    return m && m.breakfast === '燕麦牛奶 + 鸡蛋' && m.lunch === '糙米饭 + 西兰花鸡胸';
  });
  // 顶部"今天吃什么"横幅同步显示
  const banner = await page.textContent('.card:has-text("今天吃什么")');
  assert.ok(banner.includes('燕麦牛奶'), '横幅: ' + banner);
});

test('复制今天的安排并粘贴到本周另一天', async () => {
  const idx = weekDays.indexOf(todayStr);
  const target = weekDays[(idx + 1) % 7]; // 本周的下一天（周日则回到周一）
  await page.click('.dg-copy[data-date="' + todayStr + '"]');
  await page.click('.dg-paste[data-date="' + target + '"]');
  await waitFor(() => page.$eval('textarea[data-date="' + target + '"][data-meal="breakfast"]', (n) => n.value === '燕麦牛奶 + 鸡蛋'));
  const lunch = await page.$eval('textarea[data-date="' + target + '"][data-meal="lunch"]', (n) => n.value);
  assert.strictEqual(lunch, '糙米饭 + 西兰花鸡胸');
});

test('三餐吃完打勾，刷新后状态保留', async () => {
  await page.click('.dg-done button[data-date="' + todayStr + '"][data-meal="breakfast"]');
  await waitFor(() => page.$eval('.dg-done button[data-date="' + todayStr + '"][data-meal="breakfast"]', (n) => n.classList.contains('on')));
  // 等待保存落盘
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    return j.diet.meals[todayStr] && j.diet.meals[todayStr].done && j.diet.meals[todayStr].done.breakfast === true;
  });
  await page.reload();
  await waitFor(() => page.$('textarea[data-date="' + todayStr + '"]'));
  const bf = await page.$eval('textarea[data-date="' + todayStr + '"][data-meal="breakfast"]', (n) => n.value);
  assert.strictEqual(bf, '燕麦牛奶 + 鸡蛋');
  const done = await page.$eval('.dg-done button[data-date="' + todayStr + '"][data-meal="breakfast"]', (n) => n.classList.contains('on'));
  assert.strictEqual(done, true);
});
