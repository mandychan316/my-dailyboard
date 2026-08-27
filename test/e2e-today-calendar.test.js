'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const Dates = require('../public/js/dates.js');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir, today, past, jan;

async function seedTasks(dateStr, tasks) {
  const j = await (await fetch(base + '/api/data')).json();
  if (!j.today.tasksByDate[dateStr]) j.today.tasksByDate[dateStr] = [];
  j.today.tasksByDate[dateStr].push(...tasks);
  await fetch(base + '/api/data/today', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(j.today),
  });
}

before(async () => {
  dataDir = tempDataDir('wl-tcal-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  today = Dates.todayStr();
  past = today.slice(0, 7) + '-01';
  if (past === today) past = today.slice(0, 7) + '-02';
  jan = new Date().getFullYear() + '-01-10';

  await seedTasks(today, [
    { id: 'c1', text: '写周报', priority: 'high', note: '', done: true, createdAt: '2026-08-01T00:00:00.000Z' },
    { id: 'c2', text: '整理灵感', priority: 'mid', note: '', done: false, createdAt: '2026-08-01T00:00:00.000Z' },
  ]);
  await seedTasks(past, [{ id: 'c3', text: '过去的事项', priority: 'mid', note: '', done: false, createdAt: '2026-08-01T00:00:00.000Z' }]);
  await seedTasks(jan, [{ id: 'c4', text: '元旦计划', priority: 'mid', note: '', done: false, createdAt: '2026-01-01T00:00:00.000Z' }]);

  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/today');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('日历打开：有记录的日期高亮', async () => {
  await page.click('button[title="打开日历"]');
  await waitFor(() => page.$('.cal-grid'));
  const hasCount = await page.$$eval('.cal-cell.has', (ns) => ns.length);
  assert.ok(hasCount >= 2, '应有至少 2 个高亮日期，实际 ' + hasCount);
  const pastCell = await page.$('.cal-cell.has[data-date="' + past + '"]');
  assert.ok(pastCell, '本月 1 号应有记录并高亮');
  const todayCell = await page.$('.cal-cell.has[data-date="' + today + '"]');
  assert.ok(todayCell, '今天应有记录并高亮');
  await page.click('.cal-foot button:has-text("关闭")');
});

test('悬浮日期显示当日记录内容', async () => {
  await page.click('button[title="打开日历"]');
  await waitFor(() => page.$('.cal-cell.has'));
  await page.hover('.cal-cell.has[data-date="' + past + '"]');
  await waitFor(() => page.$eval('.cal-cell.has[data-date="' + past + '"] .cal-tip', (n) => n.offsetParent !== null));
  const tip = await page.textContent('.cal-cell.has[data-date="' + past + '"] .cal-tip');
  assert.ok(tip.includes('过去的事项'), '悬浮应显示当日内容: ' + tip);
  // 今天的内容也应显示完成标记
  await page.hover('.cal-cell.has[data-date="' + today + '"]');
  await waitFor(() => page.$eval('.cal-cell.has[data-date="' + today + '"] .cal-tip', (n) => n.offsetParent !== null));
  const todayTip = await page.textContent('.cal-cell.has[data-date="' + today + '"] .cal-tip');
  assert.ok(todayTip.includes('写周报'), '悬浮应显示今天内容');
  assert.ok(todayTip.includes('✓'), '已完成事项应有 ✓');
  // 关闭
  await page.click('.cal-foot button:has-text("关闭")');
});

test('点击日历日期跳转到对应日计划', async () => {
  await page.click('button[title="打开日历"]');
  await waitFor(() => page.$('.cal-cell'));
  await page.click('.cal-cell.has[data-date="' + past + '"]');
  await waitFor(() => page.$eval('.date-label', (n, exp) => n.textContent.includes(exp), Dates.formatCN(past)));
  const label = await page.textContent('.date-label');
  const p = Dates.parseDate(past);
  assert.ok(label.includes((p.getMonth() + 1) + '月' + p.getDate() + '日'), '应跳转到所选日期: ' + label);
  const items = await page.$$eval('.task-item', (ns) => ns.map((n) => n.textContent));
  assert.ok(items.some((t) => t.includes('过去的事项')), '应显示该日任务');
});

test('可翻到当年 1 月查看 1/1 开始记录', async () => {
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
  assert.ok(janCell, '1 月 10 日应有记录并高亮');
  await page.hover('.cal-cell.has[data-date="' + jan + '"]');
  await waitFor(() => page.$eval('.cal-cell.has[data-date="' + jan + '"] .cal-tip', (n) => n.offsetParent !== null));
  const tip = await page.textContent('.cal-cell.has[data-date="' + jan + '"] .cal-tip');
  assert.ok(tip.includes('元旦计划'), '应显示 1 月记录: ' + tip);
});
