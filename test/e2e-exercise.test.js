'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-ex-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/exercise');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('设置每周计划：内容与时长保存到数据文件', async () => {
  const rows = await page.$$('.week-row');
  // 周一
  const inputs1 = await rows[0].$$('input');
  await inputs1[0].fill('肩颈拉伸');
  await inputs1[1].fill('20');
  // 周三
  const inputs3 = await rows[2].$$('input');
  await inputs3[0].fill('流瑜伽');
  await inputs3[1].fill('45');
  await page.click('.page-title'); // 失焦触发 change，统计应更新
  await waitFor(() => page.$eval('.progress-text', (n) => n.textContent.includes('0/2')));
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    const p = j.exercise.weekPlan;
    return p['1'] && p['1'].content === '肩颈拉伸' && p['1'].minutes === 20 &&
      p['3'] && p['3'].content === '流瑜伽' && p['3'].minutes === 45;
  });
});

test('今日打卡：统计变为 1/2，可取消', async () => {
  await waitFor(() => page.$('.checkin-row.today .btn'));
  let stats = await page.textContent('.progress-text');
  assert.ok(stats.includes('0/2'), '初始统计: ' + stats);
  await page.click('.checkin-row.today .btn');
  await waitFor(() => page.$eval('.checkin-row.today .btn', (n) => n.textContent.includes('已打卡')));
  stats = await page.textContent('.progress-text');
  assert.ok(stats.includes('1/2'), '打卡后统计: ' + stats);
  // 取消打卡
  await page.click('.checkin-row.today .btn');
  await waitFor(() => page.$eval('.checkin-row.today .btn', (n) => n.textContent.includes('打卡')));
  stats = await page.textContent('.progress-text');
  assert.ok(stats.includes('0/2'), '取消后统计: ' + stats);
});

test('额外记录：填写后保存', async () => {
  const extra = await page.$('.checkin-row.today .ci-extra input');
  await extra.fill('又加练 10 分钟拉伸');
  await page.click('.page-title'); // 让输入框失焦触发 change
  const today = new Date();
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    return j.exercise.checkins[todayStr] && j.exercise.checkins[todayStr].extra === '又加练 10 分钟拉伸';
  });
});

test('再次打卡并刷新，计划与打卡数据仍在', async () => {
  await page.click('.checkin-row.today .btn');
  await waitFor(() => page.$eval('.checkin-row.today .btn', (n) => n.textContent.includes('已打卡')));
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    const today = new Date();
    const ts = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    return j.exercise.checkins[ts] && j.exercise.checkins[ts].done === true;
  });
  await page.reload();
  await waitFor(() => page.$('.week-row'));
  // 计划还在
  const rows = await page.$$('.week-row');
  const inputs1 = await rows[0].$$('input');
  assert.strictEqual(await inputs1[0].inputValue(), '肩颈拉伸');
  assert.strictEqual(await inputs1[1].inputValue(), '20');
  // 打卡状态还在
  const todayBtn = await page.$('.checkin-row.today .btn');
  assert.ok((await todayBtn.textContent()).includes('已打卡'));
  const stats = await page.textContent('.progress-text');
  assert.ok(stats.includes('1/2'), '刷新后统计: ' + stats);
});
