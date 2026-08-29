'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-theme-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/settings');
  await waitFor(() => page.$('.theme-options'));
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('设置页提供 5 种风格选择', async () => {
  const names = await page.$$eval('.theme-opt .t-name', (ns) => ns.map((n) => n.textContent.trim()));
  assert.deepStrictEqual(names, ['暖色手账', '薄荷晨光', '深夜墨蓝', '编辑部黑白', '暖阳奶油']);
});

test('切换风格立即生效并保存，刷新后保留', async () => {
  // 默认暖色手账
  let theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  assert.strictEqual(theme, 'warm');
  let bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.strictEqual(bg, 'rgb(241, 244, 241)', '暖色手账底色');

  // 切到薄荷晨光
  await page.click('.theme-opt[data-theme="mint"]');
  await waitFor(() => page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'mint'));
  bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.strictEqual(bg, 'rgb(244, 250, 247)', '薄荷晨光底色');
  await waitFor(async () => {
    const j = await (await fetch(base + '/api/data')).json();
    return j.preferences && j.preferences.theme === 'mint';
  });

  // 刷新后仍保留薄荷晨光
  await page.reload();
  await waitFor(() => page.$('.theme-options'));
  theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  assert.strictEqual(theme, 'mint', '刷新后应保留所选风格');
  const active = await page.textContent('.theme-opt.active .t-name');
  assert.ok(active.includes('薄荷晨光'), '选中态应正确');

  // 切到深夜墨蓝
  await page.click('.theme-opt[data-theme="dark"]');
  await waitFor(() => page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark'));
  bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.strictEqual(bg, 'rgb(27, 36, 48)', '深夜墨蓝底色');

  // 回到暖色手账
  await page.click('.theme-opt[data-theme="warm"]');
  await waitFor(() => page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'warm'));
  bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.strictEqual(bg, 'rgb(241, 244, 241)', '回到暖色手账');
});
