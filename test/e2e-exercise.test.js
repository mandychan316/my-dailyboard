'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const Dates = require('../public/js/dates.js');
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

test('本周打卡位于每周计划下方', async () => {
  const pos = await page.$$eval('.page .card', (ns) => {
    const plan = ns.find((n) => n.querySelector('.week-row'));
    const checkin = ns.find((n) => n.textContent.includes('本周打卡'));
    return {
      planTop: plan ? plan.getBoundingClientRect().top : -1,
      checkinTop: checkin ? checkin.getBoundingClientRect().top : -1,
    };
  });
  assert.ok(pos.planTop >= 0 && pos.checkinTop >= 0, '应能找到两张卡片');
  assert.ok(pos.checkinTop > pos.planTop, '本周打卡应在每周计划下方');
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

test('打卡按钮位于每行最后', async () => {
  const rows = await page.$$eval('.checkin-row', (ns) => ns.map((n) => {
    const last = n.lastElementChild;
    return last && last.classList.contains('btn') && /^(已)?打卡$/.test(last.textContent.trim());
  }));
  assert.strictEqual(rows.length, 7, '应有 7 行');
  assert.ok(rows.every(Boolean), '每行最后一个元素都应是打卡按钮');
});

test('今天以轻量标识显示，不再占用独立标签', async () => {
  const todayHasChip = await page.$('.checkin-row.today .chip');
  assert.strictEqual(todayHasChip, null, '今天不应再使用独立标签');
  const tag = await page.textContent('.checkin-row.today .ci-date .today-tag');
  assert.ok(tag.includes('今天'), '今天应有轻量标识');
  const otherHasTag = await page.$$eval('.checkin-row:not(.today) .today-tag', (ns) => ns.length);
  assert.strictEqual(otherHasTag, 0, '其他天不应有今天标识');
});

test('补充每周计划后，本周打卡的需锻炼自动更新', async () => {
  // 先给本周第一天（周一）设置新的计划内容
  const rows = await page.$$('.week-row');
  const mondayInput = await rows[0].$$('input');
  await mondayInput[0].fill('拜日式');
  await mondayInput[1].fill('25');
  await page.click('.page-title'); // 失焦触发自动同步
  const mondayDate = Dates.weekDays(Dates.todayStr())[0];
  await waitFor(() => page.$eval('.checkin-row[data-date="' + mondayDate + '"] .ci-required input', (n) => n.value === '拜日式'));
  // 有按日覆盖的今天不受周计划影响
  const todayDate = Dates.todayStr();
  await page.fill('.checkin-row.today .ci-required input', '自定内容');
  await page.click('.page-title');
  await page.locator('.week-row').first().locator('input[type="text"]').fill('其他计划');
  await page.click('.page-title');
  const todayVal = await page.$eval('.checkin-row[data-date="' + todayDate + '"] .ci-required input', (n) => n.value);
  assert.strictEqual(todayVal, '自定内容', '按日覆盖不应被周计划覆盖');
});

test('本周打卡增加时长输入，可保存到数据', async () => {
  const rows = await page.$$eval('.checkin-row', (ns) => ns.map((n) => !!n.querySelector('.ci-minutes input[type="number"]')));
  assert.strictEqual(rows.length, 7, '应有 7 行');
  assert.ok(rows.every(Boolean), '每行都应有时长输入');
  await page.fill('.checkin-row.today .ci-minutes input', '30');
  await page.click('.page-title'); // 失焦保存
  const todayStr = Dates.todayStr();
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    return j.exercise.checkins[todayStr] && j.exercise.checkins[todayStr].minutes === 30;
  });
});

test('点击打卡后左侧控件不移动、不重建', async () => {
  // 确保今天处于未打卡状态
  const btnText = await page.textContent('.checkin-row.today .btn-ci');
  if (btnText.includes('已打卡')) {
    await page.click('.checkin-row.today .btn-ci');
    await waitFor(() => page.$eval('.checkin-row.today .btn-ci', (n) => n.textContent === '打卡'));
  }
  // 填入需锻炼内容并保存
  await page.fill('.checkin-row.today .ci-required input', '保持不动的内容');
  await page.click('.page-title');
  const todayStr = Dates.todayStr();
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    return j.exercise.checkins[todayStr] && j.exercise.checkins[todayStr].content === '保持不动的内容';
  });
  const before = await page.evaluate(() => {
    const row = document.querySelector('.checkin-row.today');
    const input = row.querySelector('.ci-required input');
    const btn = row.querySelector('.btn-ci');
    const ir = input.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    return { inputLeft: Math.round(ir.left), inputVal: input.value, btnWidth: Math.round(br.width), btnText: btn.textContent };
  });
  await page.click('.checkin-row.today .btn-ci');
  await waitFor(() => page.$eval('.checkin-row.today .btn-ci', (n) => n.textContent === '已打卡'));
  const after = await page.evaluate(() => {
    const row = document.querySelector('.checkin-row.today');
    const input = row.querySelector('.ci-required input');
    const btn = row.querySelector('.btn-ci');
    const ir = input.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    return { inputLeft: Math.round(ir.left), inputVal: input.value, btnWidth: Math.round(br.width), btnText: btn.textContent };
  });
  assert.strictEqual(after.inputLeft, before.inputLeft, '左侧输入位置不应变化');
  assert.strictEqual(after.inputVal, before.inputVal, '输入内容不应被清空');
  assert.strictEqual(after.btnWidth, before.btnWidth, '打卡按钮宽度不应变化');
  assert.strictEqual(after.btnText, '已打卡');
});
