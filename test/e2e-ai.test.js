'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-ai-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/ai');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

async function addLog({ purpose, tool, content, reflection }) {
  await page.click('button:has-text("记录一次")');
  await waitFor(() => page.$('.form-modal'));
  if (purpose) await page.selectOption('.form-modal select', purpose);
  if (tool) await page.fill('.form-modal input[type="text"]', tool);
  const areas = await page.$$('.form-modal textarea');
  await areas[0].fill(content);
  if (reflection) await areas[1].fill(reflection);
  await page.click('.form-modal .btn-primary');
}

test('新增使用日志：日期/用途/工具/内容/心得都显示', async () => {
  await addLog({ purpose: '写文案', tool: 'ChatGPT', content: '写一条小红书标题', reflection: '效果不错' });
  await waitFor(() => page.$eval('.item-card', (n) => n.textContent.includes('写一条小红书标题')));
  const text = await page.textContent('.item-card');
  const today = new Date();
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  assert.ok(text.includes(todayStr), '日期');
  assert.ok(text.includes('写文案'), '用途');
  assert.ok(text.includes('ChatGPT'), '工具');
  assert.ok(text.includes('写一条小红书标题'), '内容');
  assert.ok(text.includes('效果不错'), '心得');
});

test('新增第二条日志并按用途筛选', async () => {
  await addLog({ purpose: '学习', tool: 'Claude', content: '学习瑜伽体式要点', reflection: '' });
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 2));
  // 筛选：写文案
  await page.selectOption('.filter-bar select', '写文案');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 1));
  let text = await page.textContent('.item-card');
  assert.ok(text.includes('写一条小红书标题'));
  assert.ok(!text.includes('学习瑜伽体式要点'));
  // 筛选：全部
  await page.selectOption('.filter-bar select', 'all');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 2));
});

test('编辑日志生效', async () => {
  await page.selectOption('.filter-bar select', 'all');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 2));
  const btns = await page.$$('.item-card:first-child .ic-actions button');
  await btns[0].click();
  await waitFor(() => page.$('.form-modal'));
  const areas = await page.$$('.form-modal textarea');
  await areas[0].fill('写一条小红书标题（改）');
  await page.click('.form-modal .btn-primary');
  await waitFor(() => page.$eval('.item-card:first-child', (n) => n.textContent.includes('写一条小红书标题（改）')));
});

test('删除日志：确认后消失', async () => {
  const btns = await page.$$('.item-card:first-child .ic-actions button');
  await btns[1].click();
  await waitFor(() => page.$('.modal'));
  await page.click('.modal-actions .btn-danger');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 1));
  const text = await page.textContent('.item-card');
  assert.ok(!text.includes('写一条小红书标题（改）'));
});

test('新增提示词模板：分类/标题/内容/场景/效果', async () => {
  await page.click('.tab:has-text("提示词库")');
  await waitFor(() => page.$('button:has-text("新增模板")'));
  await page.click('button:has-text("新增模板")');
  await waitFor(() => page.$('.form-modal'));
  await page.selectOption('.form-modal select', '写作');
  const inputs = await page.$$('.form-modal input[type="text"]');
  await inputs[0].fill('周报总结助手');
  await page.fill('.form-modal textarea', '请把以下工作内容整理成一份周报：\n{粘贴内容}');
  await inputs[1].fill('每周五写周报');
  await inputs[2].fill('输出稳定');
  await page.click('.form-modal .btn-primary');
  await waitFor(() => page.$eval('.item-card', (n) => n.textContent.includes('周报总结助手')));
  const text = await page.textContent('.item-card');
  assert.ok(text.includes('写作'));
  assert.ok(text.includes('周报总结助手'));
  assert.ok(text.includes('整理成一份周报'));
  assert.ok(text.includes('每周五写周报'));
  assert.ok(text.includes('输出稳定'));
});

test('复制模板内容到剪贴板', async () => {
  await page.click('.item-card button:has-text("复制")');
  await waitFor(async () => {
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    return clip.includes('整理成一份周报');
  });
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(clip.includes('整理成一份周报'));
});

test('按分类筛选模板（下拉框）', async () => {
  await page.selectOption('#prompt-category-filter', '编程');
  await waitFor(() => page.$eval('.empty', (n) => n.textContent.includes('还没有模板')));
  await page.selectOption('#prompt-category-filter', '写作');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 1));
  await page.selectOption('#prompt-category-filter', 'all');
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 1));
});

test('刷新后日志和模板都还在', async () => {
  await waitFor(async () => {
    const r = await fetch(base + '/api/data');
    const j = await r.json();
    return j.ai.logs.length === 1 && j.ai.prompts.length === 1;
  });
  await page.reload();
  await waitFor(() => page.$$eval('.item-card', (ns) => ns.length === 1));
  // 切到日志确认
  await page.click('.tab:has-text("使用日志")');
  await waitFor(() => page.$eval('.item-card', (n) => n.textContent.includes('写一条小红书标题')));
});
