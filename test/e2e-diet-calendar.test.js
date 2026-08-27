'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const Dates = require('../public/js/dates.js');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir, today, past, otherWeek, jan;

before(async () => {
  dataDir = tempDataDir('wl-dietcal-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  today = Dates.todayStr();
  past = today.slice(0, 7) + '-01';
  if (past === today) past = today.slice(0, 7) + '-02';
  otherWeek = Dates.addDays(today, -7);
  jan = new Date().getFullYear() + '-01-10';
  const days = {};
  days[today] = { items: [{ id: 'i1', text: '中药', done: true }, { id: 'i2', text: '水煮蛋', done: false }] };
  days[past] = { items: [{ id: 'i3', text: '五红粉', done: true }] };
  days[otherWeek] = { items: [{ id: 'i4', text: '牛奶', done: true }] };
  days[jan] = { items: [{ id: 'i5', text: '豆浆', done: true }] };
  await fetch(base + '/api/data/diet', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ defaults: [], days }),
  });
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/diet');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('饮食日历：吃过的日期高亮', async () => {
  await page.click('button[title="打开日历"]');
  await waitFor(() => page.$('.cal-grid'));
  const todayCell = await page.$('.cal-cell.has[data-date="' + today + '"]');
  assert.ok(todayCell, '今天（吃过）应高亮');
  const pastCell = await page.$('.cal-cell.has[data-date="' + past + '"]');
  assert.ok(pastCell, '月初（吃过）应高亮');
  await page.click('.cal-foot button:has-text("关闭")');
});

test('悬浮日期显示当天吃过的内容', async () => {
  await page.click('button[title="打开日历"]');
  await waitFor(() => page.$('.cal-cell.has'));
  await page.hover('.cal-cell.has[data-date="' + today + '"]');
  await waitFor(() => page.$eval('.cal-cell.has[data-date="' + today + '"] .cal-tip', (n) => n.offsetParent !== null));
  const tip = await page.textContent('.cal-cell.has[data-date="' + today + '"] .cal-tip');
  assert.ok(tip.includes('中药'), '应显示吃过内容: ' + tip);
  assert.ok(tip.includes('✓'), '吃过的应有 ✓');
  assert.ok(tip.includes('水煮蛋'), '未吃的也应列出: ' + tip);
  await page.click('.cal-foot button:has-text("关闭")');
});

test('点击日期切到对应周，可回到本周', async () => {
  await page.click('button[title="打开日历"]');
  await waitFor(() => page.$('.cal-cell'));
  await page.click('.cal-cell.has[data-date="' + otherWeek + '"]');
  await waitFor(() => page.$('button:has-text("回到本周")'));
  const small = await page.textContent('.card:has-text("本周打卡") .card-title small');
  assert.ok(small.includes('正在查看 ' + Dates.weekStart(otherWeek)), '应显示所查看周: ' + small);
  // 该周（上周）应显示记录内容
  await waitFor(() => page.$$eval('.dw-card', (ns) => ns.some((n) => n.textContent.includes('牛奶'))));
  await page.click('button:has-text("回到本周")');
  await waitFor(() => page.$eval('.card:has-text("本周打卡") .card-title small', (n, exp) => n.textContent.includes(exp), '从 ' + Dates.weekStart(today)));
});

test('可翻到当年 1 月查看 1/1 开始的记录', async () => {
  await page.click('button[title="打开日历"]');
  await waitFor(() => page.$('.cal-grid'));
  let found = false;
  for (let i = 0; i < 13; i++) {
    const label = await page.textContent('.cal-month');
    if (label.includes('1月') && label.includes(new Date().getFullYear())) { found = true; break; }
    await page.click('.cal-head button[title="上个月"]');
  }
  assert.ok(found, '应能翻到当年 1 月');
  const janCell = await page.$('.cal-cell.has[data-date="' + jan + '"]');
  assert.ok(janCell, '1 月 10 日（吃过）应高亮');
  await page.hover('.cal-cell.has[data-date="' + jan + '"]');
  await waitFor(() => page.$eval('.cal-cell.has[data-date="' + jan + '"] .cal-tip', (n) => n.offsetParent !== null));
  const tip = await page.textContent('.cal-cell.has[data-date="' + jan + '"] .cal-tip');
  assert.ok(tip.includes('豆浆'), '应显示 1 月记录: ' + tip);
});
