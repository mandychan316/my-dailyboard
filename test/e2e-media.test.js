'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-media-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/media');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('灵感库：新增灵感并显示平台与状态', async () => {
  await page.fill('#idea-text', '瑜伽初学者 10 个动作');
  await page.selectOption('#idea-platform', '小红书');
  await page.click('button:has-text("记下来")');
  await waitFor(() => page.$eval('.item-card', (n) => n.textContent.includes('瑜伽初学者 10 个动作')));
  const text = await page.textContent('.item-card');
  assert.ok(text.includes('小红书'));
  assert.ok(text.includes('灵感'));
});

test('灵感转为内容：灵感标记已转，内容管理出现撰写中', async () => {
  await page.click('.item-card button:has-text("转为内容")');
  await waitFor(() => page.$eval('.item-card', (n) => n.textContent.includes('已转内容')));
  await page.click('.tab:has-text("内容管理")');
  await waitFor(() => page.$eval('.item-card', (n) => n.textContent.includes('瑜伽初学者 10 个动作')));
  const text = await page.textContent('.item-card');
  // 撰写中：卡片有“推进 → 待发布”按钮（卡片上不再显示状态标签）
  assert.ok(text.includes('推进 → 待发布'), '撰写中内容应有推进到待发布的按钮: ' + text);
});

test('新增内容：平台/标题/状态/链接/日期/备注都保存', async () => {
  await page.click('button:has-text("新增内容")');
  await waitFor(() => page.$('.form-modal'));
  await page.selectOption('.form-modal select', '抖音'); // 第一个 select 是平台
  const inputs = await page.$$('.form-modal input[type="text"]');
  await inputs[0].fill('周末探店 Vlog');
  const selects = await page.$$('.form-modal select');
  await selects[1].selectOption('ready'); // 第二个 select 是状态
  await inputs[1].fill('https://example.com/vlog');
  await page.fill('.form-modal input[type="date"]', '2026-08-30');
  await inputs[2].fill('记得加字幕');
  await page.click('.form-modal .btn-primary');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 2));
  const text = await page.textContent('.item-card:first-child');
  assert.ok(text.includes('周末探店 Vlog'));
  assert.ok(text.includes('抖音'));
  assert.ok(text.includes('2026-08-30'));
  assert.ok(text.includes('记得加字幕'));
  // 待发布状态通过“推进到已发布”按钮体现（卡片上不再显示状态标签）
  const advance = await page.$('.item-card:first-child button:has-text("推进")');
  assert.ok(advance, '待发布内容应有推进按钮');
});

test('按平台筛选内容', async () => {
  await page.selectOption('.filter-bar select', '小红书');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 1));
  let text = await page.textContent('.item-card');
  assert.ok(text.includes('瑜伽初学者 10 个动作'));
  assert.ok(!text.includes('周末探店 Vlog'));
  await page.selectOption('.filter-bar select', '抖音');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 1));
  text = await page.textContent('.item-card');
  assert.ok(text.includes('周末探店 Vlog'));
  await page.selectOption('.filter-bar select', 'all');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 2));
});

test('状态推进到已发布自动填日期，可回退', async () => {
  // 第一张卡是 Vlog（待发布），有“推进”按钮且无“回退”前置于撰写
  await page.click('.item-card:first-child button:has-text("推进")');
  // 已发布：推进按钮消失，保留回退按钮
  await waitFor(() => page.$eval('.item-card:first-child', (n) => !n.textContent.includes('推进')));
  // 回退一步：推进按钮恢复
  await page.click('.item-card:first-child button[title="回退一步"]');
  await waitFor(() => page.$eval('.item-card:first-child', (n) => n.textContent.includes('推进')));
  // 再推进回已发布（保持最终状态）
  await page.click('.item-card:first-child button:has-text("推进")');
  await waitFor(() => page.$eval('.item-card:first-child', (n) => !n.textContent.includes('推进')));
});

test('本月统计数字与数据一致', async () => {
  const stats = await page.$$eval('.stat-card', (ns) => ns.map((n) => n.textContent.replace(/\s+/g, ' ').trim()));
  const joined = stats.join('\n');
  assert.ok(stats.some((s) => s.includes('本月已发布') && s.includes('1')), '已发布: ' + joined);
  assert.ok(stats.some((s) => s.includes('待发布') && s.includes('0')), '待发布: ' + joined);
  assert.ok(stats.some((s) => s.includes('撰写中') && s.includes('1')), '撰写中: ' + joined);
  assert.ok(stats.some((s) => s.includes('灵感') && s.includes('0')), '灵感: ' + joined);
  const summary = await page.textContent('.card:has-text("本月发布分布")');
  assert.ok(summary.includes('抖音 1'), '发布分布: ' + summary);
});

test('编辑内容标题生效', async () => {
  const btns = await page.$$('.item-card:first-child button[title="编辑"]');
  await btns[0].click();
  await waitFor(() => page.$('.form-modal'));
  const inputs = await page.$$('.form-modal input[type="text"]');
  await inputs[0].fill('周末探店 Vlog（改）');
  await page.click('.form-modal .btn-primary');
  await waitFor(() => page.$eval('.item-card:first-child', (n) => n.textContent.includes('周末探店 Vlog（改）')));
});

test('删除灵感：确认后灵感库清空', async () => {
  await page.click('.tab:has-text("灵感库")');
  await waitFor(() => page.$('.item-card button[title="删除"]'));
  await page.click('.item-card button[title="删除"]');
  await waitFor(() => page.$('.modal'));
  await page.click('.modal-actions .btn-danger');
  await waitFor(() => page.$eval('.empty', (n) => n.textContent.includes('灵感库还空着')));
});

test('刷新后内容数据仍在', async () => {
  await waitFor(async () => {
    const r = await fetch(base + '/api/data');
    const j = await r.json();
    return j.media.posts.length === 2 && j.media.ideas.length === 0;
  });
  await page.reload();
  await waitFor(() => page.$$eval('.stat-card', (ns) => ns.length === 4));
  await page.click('.tab:has-text("内容管理")');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 2));
  const text = await page.textContent('.item-card:first-child');
  assert.ok(text.includes('周末探店 Vlog（改）'));
});
