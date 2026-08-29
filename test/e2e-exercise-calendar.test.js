'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const Dates = require('../public/js/dates.js');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir, today, past, otherWeek;

before(async () => {
  dataDir = tempDataDir('wl-excal-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  today = Dates.todayStr();
  past = today.slice(0, 7) + '-01';
  if (past === today) past = today.slice(0, 7) + '-02';
  otherWeek = Dates.addDays(today, -7);

  // 用按日期的内容播种，避免“本周与历史日同星期”时相互覆盖
  await fetch(base + '/api/data/exercise', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      weekPlan: {},
      checkins: {
        [today]: { done: true, extra: '加练 10 分钟', content: '流瑜伽', minutes: 45 },
        [past]: { done: true, extra: '', content: '肩颈拉伸', minutes: 20 },
        [otherWeek]: { done: true, extra: '' },
      },
    }),
  });

  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/exercise');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('运动日历：打卡过的日期高亮', async () => {
  await page.click('button[title="打开日历"]');
  await waitFor(() => page.$('.cal-grid'));
  const pastCell = await page.$('.cal-cell.has[data-date="' + past + '"]');
  assert.ok(pastCell, '打卡日期应高亮');
  const todayCell = await page.$('.cal-cell.has[data-date="' + today + '"]');
  assert.ok(todayCell, '今天应高亮');
  await page.click('.cal-foot button:has-text("关闭")');
});

test('悬浮日期展示当天运动与时长', async () => {
  await page.click('button[title="打开日历"]');
  await waitFor(() => page.$('.cal-cell.has'));
  await page.hover('.cal-cell.has[data-date="' + past + '"]');
  await waitFor(() => page.$eval('.cal-cell.has[data-date="' + past + '"] .cal-tip', (n) => n.offsetParent !== null));
  const tip = await page.textContent('.cal-cell.has[data-date="' + past + '"] .cal-tip');
  assert.ok(tip.includes('已打卡'), '应有打卡标记: ' + tip);
  assert.ok(tip.includes('肩颈拉伸'), '应显示运动内容: ' + tip);
  assert.ok(tip.includes('20 分钟'), '应显示时长: ' + tip);
  // 今天还应有额外记录
  await page.hover('.cal-cell.has[data-date="' + today + '"]');
  await waitFor(() => page.$eval('.cal-cell.has[data-date="' + today + '"] .cal-tip', (n) => n.offsetParent !== null));
  const todayTip = await page.textContent('.cal-cell.has[data-date="' + today + '"] .cal-tip');
  assert.ok(todayTip.includes('流瑜伽'), todayTip);
  assert.ok(todayTip.includes('45 分钟'), todayTip);
  assert.ok(todayTip.includes('加练 10 分钟'), todayTip);
  await page.click('.cal-foot button:has-text("关闭")');
});

test('点击日期可按周查看，并能回到本周', async () => {
  await page.click('button[title="打开日历"]');
  await waitFor(() => page.$('.cal-cell'));
  await page.click('.cal-cell.has[data-date="' + otherWeek + '"]');
  await waitFor(() => page.$('button:has-text("回到本周")'));
  const small = await page.textContent('.card:has-text("本周打卡") .card-title small');
  assert.ok(small.includes('正在查看 ' + Dates.weekStart(otherWeek)), '应显示所查看周: ' + small);
  await page.click('button:has-text("回到本周")');
  await waitFor(() => page.$eval('.card:has-text("本周打卡") .card-title small', (n, exp) => n.textContent.includes(exp), '从 ' + Dates.weekStart(today)));
});
