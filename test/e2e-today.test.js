'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-today-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/today');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('新增事项：内容/优先级/备注都显示，且没有时间选项', async () => {
  const hasTime = await page.$('#task-time');
  assert.strictEqual(hasTime, null, '新增表单不应有时间输入');
  await page.fill('#task-text', '写周报');
  await page.selectOption('#task-priority', 'high');
  await page.fill('#task-note', '汇总本周 AI 实践');
  await page.click('button:has-text("添加")');
  await waitFor(() => page.$eval('.task-item', (n) => n.textContent.includes('写周报')));
  const text = await page.textContent('.task-item');
  assert.ok(text.includes('写周报'), '内容');
  assert.ok(text.includes('高'), '优先级');
  assert.ok(text.includes('汇总本周 AI 实践'), '备注');
  // 进度应为 0/1
  const prog = await page.textContent('.progress-text');
  assert.ok(prog.includes('0/1'), '进度: ' + prog);
});

test('回车键也能添加事项', async () => {
  await page.fill('#task-text', '晚上拉伸 20 分钟');
  await page.press('#task-text', 'Enter');
  await waitFor(() => page.$$eval('.task-item', (ns) => ns.length === 2));
  const count = await page.$$eval('.task-item', (ns) => ns.length);
  assert.strictEqual(count, 2);
});

test('勾选完成：进度更新，再点取消恢复', async () => {
  // 勾选第一项
  await page.click('.task-item:first-child .task-check');
  await waitFor(() => page.$eval('.task-item:first-child', (n) => n.classList.contains('done')));
  let prog = await page.textContent('.progress-text');
  assert.ok(prog.includes('1/2'), '勾选后进度: ' + prog);
  // 取消勾选
  await page.click('.task-item:first-child .task-check');
  await waitFor(() => page.$eval('.task-item:first-child', (n) => !n.classList.contains('done')));
  prog = await page.textContent('.progress-text');
  assert.ok(prog.includes('0/2'), '取消后进度: ' + prog);
});

test('编辑事项：修改内容后保存生效', async () => {
  const btns = await page.$$('.task-item:first-child .task-actions button');
  await btns[0].click(); // 编辑
  await waitFor(() => page.$('.form-modal'));
  const input = await page.$('.form-modal input[type="text"]');
  await input.fill('写周报（改）');
  await page.click('.form-modal .btn-primary');
  await waitFor(() => page.$eval('.task-item:first-child', (n) => n.textContent.includes('写周报（改）')));
  const text = await page.textContent('.task-item:first-child');
  assert.ok(text.includes('写周报（改）'));
});

test('删除事项：取消不删，确认后删除', async () => {
  // 取消删除
  let btns = await page.$$('.task-item:first-child .task-actions button');
  await btns[1].click(); // 删除
  await waitFor(() => page.$('.modal'));
  await page.click('.modal-actions .btn:not(.btn-danger)');
  await waitFor(() => page.$$eval('.task-item', (ns) => ns.length === 2));
  // 确认删除
  btns = await page.$$('.task-item:first-child .task-actions button');
  await btns[1].click();
  await waitFor(() => page.$('.modal'));
  await page.click('.modal-actions .btn-danger');
  await waitFor(() => page.$$eval('.task-item', (ns) => ns.length === 1));
  const text = await page.textContent('.task-item:first-child');
  assert.ok(!text.includes('写周报（改）'));
});

test('日期切换：后一天为空，回到今天数据还在', async () => {
  // 记录今天的事项数
  const todayCount = await page.$$eval('.task-item', (ns) => ns.length);
  // 点“后一天”
  await page.click('.date-nav button:nth-child(3)');
  await waitFor(() => page.$eval('.empty', (n) => n.textContent.includes('还没有计划')));
  // 回到今天
  await page.click('button:has-text("回到今天")');
  await waitFor(async () => (await page.$$eval('.task-item', (ns) => ns.length)) === todayCount);
  assert.strictEqual(await page.$$eval('.task-item', (ns) => ns.length), todayCount);
});

test('刷新页面后事项仍在', async () => {
  await waitFor(async () => {
    const r = await fetch(base + '/api/data');
    const j = await r.json();
    const today = Object.keys(j.today.tasksByDate || {})[0];
    return today && j.today.tasksByDate[today].length >= 1;
  });
  await page.reload();
  await waitFor(() => page.$$eval('.task-item', (ns) => ns.length >= 1));
  const text = await page.textContent('.task-item:first-child');
  assert.ok(text.includes('晚上拉伸 20 分钟') || text.includes('写周报'), '刷新后数据丢失: ' + text);
});
