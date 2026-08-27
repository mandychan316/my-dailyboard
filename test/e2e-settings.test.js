'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { tempDataDir, startServer, newPage, waitFor } = require('./helpers');

let server, base, browser, page, dataDir;

before(async () => {
  dataDir = tempDataDir('wl-bak-');
  server = await startServer(dataDir);
  base = 'http://127.0.0.1:' + server.port;
  const b = await newPage();
  browser = b.browser;
  page = b.page;
  await page.goto(base + '/#/settings');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.proc.kill();
});

test('设置页显示数据文件夹路径', async () => {
  await waitFor(() => page.$('.path-box'));
  const text = await page.textContent('.path-box');
  assert.ok(text.includes('wl-bak-'), '应显示数据目录: ' + text);
});

test('导出备份：生成包含全部模块的文件', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("导出备份")'),
  ]);
  const filePath = await download.path();
  assert.ok(filePath, '应产生下载文件');
  const backup = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.strictEqual(backup.app, 'worklife-app');
  assert.ok(backup.exportedAt, '应有导出时间');
  for (const m of ['today', 'ai', 'media', 'exercise', 'diet', 'notes', 'meta']) {
    assert.ok(backup.data[m] !== undefined, '缺少模块数据: ' + m);
  }
  const name = download.suggestedFilename();
  assert.ok(/worklife-backup-.*\.json/.test(name), '文件名: ' + name);
});

test('恢复备份：覆盖当前数据', async () => {
  // 造数据并导出备份
  await fetch(base + '/api/data/notes', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: [{ id: 'n1', text: '备份前的备忘', createdAt: '2026-08-26T00:00:00.000Z' }] }),
  });
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("导出备份")'),
  ]);
  const backupPath = await dl.path();
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert.strictEqual(backup.data.notes.notes[0].text, '备份前的备忘');

  // 改动当前数据，制造差异
  await fetch(base + '/api/data/notes', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: [{ id: 'n2', text: '改动后的备忘', createdAt: '2026-08-26T00:00:00.000Z' }] }),
  });
  let j = await (await fetch(base + '/api/data')).json();
  assert.strictEqual(j.notes.notes[0].text, '改动后的备忘');

  // 通过页面恢复备份
  await page.setInputFiles('input[type="file"]', backupPath);
  await waitFor(() => page.$('.modal'));
  const modalText = await page.textContent('.modal');
  assert.ok(modalText.includes('覆盖'), '应有覆盖提示');
  await page.click('.modal-actions .btn-danger');

  // 等待恢复完成并刷新
  await waitFor(async () => {
    const r = await (await fetch(base + '/api/data')).json();
    return r.notes.notes.length === 1 && r.notes.notes[0].text === '备份前的备忘';
  });
  j = await (await fetch(base + '/api/data')).json();
  assert.strictEqual(j.notes.notes[0].text, '备份前的备忘');
});
