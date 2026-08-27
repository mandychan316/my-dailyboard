'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const Dates = require('../public/js/dates.js');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir, todayStr;

before(async () => {
  dataDir = tempDataDir('wl-exreq-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  todayStr = Dates.todayStr();
  await fetch(base + '/api/data/exercise', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      weekPlan: { [String(Dates.weekdayIndex(todayStr))]: { content: '默认拉伸', minutes: 15 } },
      checkins: {},
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

test('每天需锻炼内容默认取周计划，可按日修改并保存', async () => {
  await waitFor(() => page.$('.checkin-row.today .ci-required input'));
  let value = await page.$eval('.checkin-row.today .ci-required input', (n) => n.value);
  assert.strictEqual(value, '默认拉伸', '应默认显示周计划内容');
  // 修改为当天自己的需锻炼内容
  await page.fill('.checkin-row.today .ci-required input', '拜日式');
  await page.click('.page-title'); // 失焦触发保存
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    return j.exercise.checkins[todayStr] && j.exercise.checkins[todayStr].content === '拜日式';
  });
  // 额外锻炼仍可记录
  await page.fill('.checkin-row.today .ci-extra input', '加练 5 分钟拉伸');
  await page.click('.page-title');
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    return j.exercise.checkins[todayStr] && j.exercise.checkins[todayStr].extra === '加练 5 分钟拉伸';
  });
});

test('日历悬浮显示按日修改后的锻炼内容与时长', async () => {
  await page.click('button[title="打开日历"]');
  await waitFor(() => page.$('.cal-cell.has'));
  await page.hover('.cal-cell.has[data-date="' + todayStr + '"]');
  await waitFor(() => page.$eval('.cal-cell.has[data-date="' + todayStr + '"] .cal-tip', (n) => n.offsetParent !== null));
  const tip = await page.textContent('.cal-cell.has[data-date="' + todayStr + '"] .cal-tip');
  assert.ok(tip.includes('拜日式'), '应显示修改后的内容: ' + tip);
  assert.ok(!tip.includes('默认拉伸'), '不应再显示周计划默认内容');
  assert.ok(tip.includes('加练 5 分钟拉伸'), '应显示额外锻炼: ' + tip);
  await page.click('.cal-foot button:has-text("关闭")');
});
