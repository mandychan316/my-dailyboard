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

test('一周 7 天卡片，今天高亮', async () => {
  const cards = await page.$$eval('.dw-card', (ns) => ns.length);
  assert.strictEqual(cards, 7, '应显示 7 天');
  const todayCard = await page.$('.dw-card.today');
  assert.ok(todayCard, '今天应高亮');
});

test('添加必吃内容：显示在当天并保存到数据文件', async () => {
  const todayCard = page.locator('.dw-card.today');
  await todayCard.locator('.dw-add input').fill('燕麦牛奶');
  await todayCard.locator('.dw-add .btn').click();
  await todayCard.locator('.dw-item').filter({ hasText: '燕麦牛奶' }).waitFor();
  await todayCard.locator('.dw-add input').fill('水煮蛋');
  await todayCard.locator('.dw-add input').press('Enter');
  await todayCard.locator('.dw-item').filter({ hasText: '水煮蛋' }).waitFor();
  // 顶部“今天必吃”横幅同步
  const banner = await page.textContent('.card:has-text("今天必吃")');
  assert.ok(banner.includes('燕麦牛奶'), '横幅: ' + banner);
  // 数据落盘
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    return (j.diet.days[todayStr] || {}).items && j.diet.days[todayStr].items.length === 2;
  });
});

test('打勾表示吃过，刷新后保留', async () => {
  const first = page.locator('.dw-card.today .dw-item').filter({ hasText: '燕麦牛奶' });
  await first.locator('.dw-check').click();
  await first.locator('..').waitFor();
  await waitFor(() => page.$eval('.dw-card.today .dw-item:first-child', (n) => n.classList.contains('done')));
  const count = await page.textContent('.dw-card.today .dw-count');
  assert.ok(count.includes('1/2'), '计数: ' + count);
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    return j.diet.days[todayStr].items.some((i) => i.text === '燕麦牛奶' && i.done === true);
  });
  await page.reload();
  await waitFor(() => page.$('.dw-card.today .dw-item'));
  const done = await page.$eval('.dw-card.today .dw-item:first-child', (n) => n.classList.contains('done'));
  assert.strictEqual(done, true, '刷新后应保留打勾');
});

test('复制今天的清单粘贴到本周另一天', async () => {
  const idx = weekDays.indexOf(todayStr);
  const target = weekDays[(idx + 1) % 7];
  const targetHead = Dates.weekdayCN(target).replace('星期', '周') + ' ' + target.slice(5);
  await page.locator('.dw-card.today .dw-ops button:has-text("复制")').click();
  const targetCard = page.locator('.dw-card').filter({ hasText: targetHead });
  await targetCard.locator('.dw-ops button:has-text("粘贴")').click();
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    return (j.diet.days[target] || {}).items && j.diet.days[target].items.length === 2;
  });
  await targetCard.locator('.dw-item').filter({ hasText: '燕麦牛奶' }).waitFor();
});

test('删除必吃项：确认后删除', async () => {
  const todayCard = page.locator('.dw-card.today');
  const countBefore = await todayCard.locator('.dw-item').count();
  await todayCard.locator('.dw-item button[title="删除"]').first().click();
  await waitFor(() => page.$('.modal'));
  await page.click('.modal-actions .btn-danger');
  await waitFor(async () => (await todayCard.locator('.dw-item').count()) === countBefore - 1);
});
