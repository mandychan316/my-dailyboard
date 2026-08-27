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

test('页面包含「每日必吃」与「本周执行」两块', async () => {
  const title = await page.textContent('.page-title');
  assert.ok(title.includes('饮食计划'));
  await waitFor(() => page.$('.card:has-text("每日必吃")'));
  await waitFor(() => page.$('.card:has-text("本周执行")'));
});

test('添加每日必吃：本周每天自动带上，数据落盘', async () => {
  await page.fill('#diet-default-input', '中药');
  await page.press('#diet-default-input', 'Enter');
  // 今天卡片自动带上
  await waitFor(() => page.$eval('.dw-card.today .dw-item', (n) => n.textContent.includes('中药')));
  // 本周 7 天都应自动带上
  const count = await page.$$eval('.dw-card', (ns) => ns.filter((n) => n.textContent.includes('中药')).length);
  assert.strictEqual(count, 7, '本周 7 天都应自动带上「中药」');
  // 再添加一条
  await page.fill('#diet-default-input', '水煮蛋');
  await page.press('#diet-default-input', 'Enter');
  await waitFor(() => page.$$eval('.dw-card.today .dw-item', (ns) => ns.length === 2));
  // 数据落盘：defaults 与本周每天都有
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    const ok = j.diet.defaults && j.diet.defaults.length === 2;
    const firstDay = weekDays[0];
    return ok && j.diet.days[firstDay] && j.diet.days[firstDay].items.length === 2;
  });
});

test('勾选吃过，刷新后保留', async () => {
  const first = page.locator('.dw-card.today .dw-item').filter({ hasText: '中药' });
  await first.locator('.dw-check').click();
  await waitFor(() => page.$eval('.dw-card.today .dw-item:first-child', (n) => n.classList.contains('done')));
  const count = await page.textContent('.dw-card.today .dw-count');
  assert.ok(count.includes('1/2'), '计数: ' + count);
  await page.reload();
  await waitFor(() => page.$('.dw-card.today .dw-item'));
  const done = await page.$eval('.dw-card.today .dw-item:first-child', (n) => n.classList.contains('done'));
  assert.strictEqual(done, true, '刷新后应保留打勾');
});

test('删除某天的一项：确认后删除', async () => {
  const todayCard = page.locator('.dw-card.today');
  const beforeCount = await todayCard.locator('.dw-item').count();
  await todayCard.locator('.dw-item button[title="删除"]').first().click();
  await waitFor(() => page.$('.modal'));
  await page.click('.modal-actions .btn-danger');
  await waitFor(async () => (await todayCard.locator('.dw-item').count()) === beforeCount - 1);
});

test('删除每日必吃：只从模板删除，本周安排保留', async () => {
  // 先确认今天还剩的项数
  const todayCount = await page.locator('.dw-card.today .dw-item').count();
  await page.click('.card:has-text("每日必吃") .dw-item button[title="删除"]');
  await waitFor(() => page.$('.modal'));
  await page.click('.modal-actions .btn-danger');
  // 每日必吃剩 1 条
  await waitFor(() => page.$$eval('.card:has-text("每日必吃") .dw-item', (ns) => ns.length === 1));
  // 本周安排不减（今天仍保留原项数）
  const countAfter = await page.locator('.dw-card.today .dw-item').count();
  assert.strictEqual(countAfter, todayCount, '删除模板项不应影响本周已生成的安排');
});

test('复制今天的安排粘贴到本周另一天', async () => {
  const idx = weekDays.indexOf(todayStr);
  const target = weekDays[(idx + 1) % 7];
  const targetHead = Dates.weekdayCN(target).replace('星期', '周') + ' ' + target.slice(5);
  const todayCard = page.locator('.dw-card.today');
  const todayTexts = await todayCard.locator('.dw-item .dw-text').allTextContents();
  assert.ok(todayTexts.length >= 1);
  await todayCard.locator('.dw-ops button:has-text("复制")').click();
  const targetCard = page.locator('.dw-card').filter({ hasText: targetHead });
  await targetCard.locator('.dw-ops button:has-text("粘贴")').click();
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    return (j.diet.days[target] || {}).items && j.diet.days[target].items.length === todayTexts.length;
  });
});
