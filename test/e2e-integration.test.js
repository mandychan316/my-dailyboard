'use strict';
// 跨模块集成验收：首页摘要联动 + 重启后数据不丢

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const Dates = require('../public/js/dates.js');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir, todayStr;

async function seedData() {
  const today = todayStr;
  await fetch(base + '/api/data/today', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasksByDate: { [today]: [
      { id: 't1', text: '写周报', time: '10:00', priority: 'high', note: '', done: true, createdAt: '2026-08-26T00:00:00.000Z' },
      { id: 't2', text: '整理灵感', time: '', priority: 'mid', note: '', done: false, createdAt: '2026-08-26T00:00:00.000Z' },
    ] } }),
  });
  await fetch(base + '/api/data/diet', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meals: { [today]: { breakfast: '燕麦牛奶', lunch: '', dinner: '', done: { breakfast: true, lunch: false, dinner: false } } } }),
  });
  await fetch(base + '/api/data/exercise', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekPlan: { '1': { content: '肩颈拉伸', minutes: 20 } }, checkins: { [today]: { done: true, extra: '额外拉伸 5 分钟' } } }),
  });
  await fetch(base + '/api/data/ai', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logs: [{ id: 'l1', date: today, purpose: '写文案', tool: 'ChatGPT', content: '写标题', reflection: '', createdAt: '2026-08-26T00:00:00.000Z' }], prompts: [] }),
  });
  await fetch(base + '/api/data/media', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ideas: [], posts: [{ id: 'm1', platform: '小红书', title: '瑜伽入门', status: 'ready', link: '', publishDate: '', note: '', createdAt: '2026-08-26T00:00:00.000Z' }] }),
  });
  await fetch(base + '/api/data/notes', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: [{ id: 'n1', text: '晚上记得买牛奶', createdAt: '2026-08-26T00:00:00.000Z' }] }),
  });
}

before(async () => {
  dataDir = tempDataDir('wl-int-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  todayStr = Dates.todayStr();
  await seedData();
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/home');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('首页今日路线摘要与各模块数据一致且点亮', async () => {
  const stations = await page.$$eval('.station', (ns) => ns.map((n) => ({
    name: n.querySelector('.st-name').textContent.trim(),
    summary: n.querySelector('.st-summary').textContent.trim(),
    lit: n.classList.contains('lit'),
  })));
  const byName = Object.fromEntries(stations.map((s) => [s.name, s]));

  assert.ok(byName['今日计划'].summary.includes('完成 1/2'), JSON.stringify(byName['今日计划']));
  assert.strictEqual(byName['今日计划'].lit, true);

  assert.ok(byName['三餐'].summary.includes('早✓'), JSON.stringify(byName['三餐']));
  assert.strictEqual(byName['三餐'].lit, true);

  assert.ok(byName['运动'].summary.includes('已完成今日打卡'), JSON.stringify(byName['运动']));
  assert.strictEqual(byName['运动'].lit, true);

  assert.ok(byName['AI实践'].summary.includes('今天记录了 1 条'), JSON.stringify(byName['AI实践']));
  assert.strictEqual(byName['AI实践'].lit, true);

  assert.ok(byName['自媒体'].summary.includes('待发布 1 条'), JSON.stringify(byName['自媒体']));
  assert.strictEqual(byName['自媒体'].lit, true);
});

test('首页快捷备忘显示已保存的备忘', async () => {
  await waitFor(() => page.$eval('.memo-item .memo-text', (n) => n.textContent.includes('晚上记得买牛奶')));
});

test('重启服务后数据不丢失（同数据目录）', async () => {
  // 关闭当前服务，用同一数据目录重新启动
  const oldProc = server.proc;
  oldProc.kill();
  server = await startServer(dataDir);
  const newBase = 'http://127.0.0.1:' + server.port;
  await page.goto(newBase + '/#/home');
  await waitFor(() => page.$$eval('.station', (ns) => ns.length === 5));
  const text = await page.textContent('.station:first-child');
  assert.ok(text.includes('完成 1/2'), '重启后今日计划摘要: ' + text);
  // 备忘也在
  await waitFor(() => page.$eval('.memo-item .memo-text', (n) => n.textContent.includes('晚上记得买牛奶')));
  // 进今日计划页确认任务还在
  await page.click('.nav-item[data-view="today"]');
  await waitFor(() => page.$$eval('.task-item', (ns) => ns.length === 2));
});
