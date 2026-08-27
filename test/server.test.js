'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const SERVER = path.join(__dirname, '..', 'server.js');

let proc;
let base;
let dataDir;

function rawRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: Buffer.concat(chunks).toString('utf8'),
        })
      );
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* 非 JSON */ }
  return { status: res.status, headers: res.headers, text, json };
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-server-test-'));
  proc = spawn(process.execPath, [SERVER, '0'], {
    env: { ...process.env, DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error('服务启动超时: ' + out)), 10000);
    proc.stdout.on('data', (d) => {
      out += d.toString();
      const m = out.match(/SERVER_READY port=(\d+)/);
      if (m) { clearTimeout(timer); resolve(Number(m[1])); }
    });
    proc.stderr.on('data', (d) => { out += d.toString(); });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error('服务提前退出 code=' + code + ' ' + out)); });
  });
  base = 'http://127.0.0.1:' + port;
});

after(async () => {
  if (proc) proc.kill();
});

test('健康检查返回正常', async () => {
  const { status, json } = await fetchJSON(base + '/api/health');
  assert.strictEqual(status, 200);
  assert.strictEqual(json.ok, true);
  assert.strictEqual(json.name, 'worklife-app');
});

test('首次启动会在数据目录生成全部独立文件', () => {
  const modules = ['today', 'ai', 'media', 'exercise', 'diet', 'notes', 'meta'];
  for (const m of modules) {
    const file = path.join(dataDir, m + '.json');
    assert.ok(fs.existsSync(file), '缺少文件 ' + m + '.json');
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.ok(parsed && typeof parsed === 'object');
  }
});

test('GET /api/data 返回所有模块的默认结构', async () => {
  const { status, json } = await fetchJSON(base + '/api/data');
  assert.strictEqual(status, 200);
  assert.deepStrictEqual(json.today, { tasksByDate: {} });
  assert.deepStrictEqual(json.ai, { logs: [], prompts: [] });
  assert.deepStrictEqual(json.media, { ideas: [], posts: [] });
  assert.deepStrictEqual(json.exercise, { weekPlan: {}, checkins: {} });
  assert.deepStrictEqual(json.diet, { defaults: [], days: {} });
  assert.deepStrictEqual(json.notes, { notes: [] });
  assert.ok(json.meta.schemaVersion >= 1);
});

test('PUT 保存模块后 GET 能读到，且文件真实落盘', async () => {
  const payload = { tasksByDate: { '2026-08-25': [{ id: 'a1', text: '写 PRD', done: false }] } };
  const putRes = await fetchJSON(base + '/api/data/today', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.strictEqual(putRes.status, 200);
  assert.strictEqual(putRes.json.ok, true);

  const getRes = await fetchJSON(base + '/api/data');
  assert.strictEqual(getRes.status, 200);
  assert.deepStrictEqual(getRes.json.today, payload);

  const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, 'today.json'), 'utf8'));
  assert.deepStrictEqual(onDisk, payload);
});

test('PUT 未知模块返回 404', async () => {
  const res = await fetchJSON(base + '/api/data/nope', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.json.ok, false);
});

test('PUT 非法 JSON 返回 400', async () => {
  const res = await rawRequest(
    { hostname: '127.0.0.1', port: new URL(base).port, path: '/api/data/today', method: 'PUT' },
    '{ 这不是 JSON'
  );
  assert.strictEqual(res.status, 400);
  assert.strictEqual(JSON.parse(res.text).ok, false);
});

test('导出备份包含全部模块数据', async () => {
  const payload = { tasksByDate: { '2026-08-25': [{ id: 'b1', text: '备份测试', done: true }] } };
  await fetchJSON(base + '/api/data/today', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const res = await rawRequest({ hostname: '127.0.0.1', port: new URL(base).port, path: '/api/backup', method: 'GET' });
  assert.strictEqual(res.status, 200);
  assert.ok(/attachment/.test(res.headers['content-disposition'] || ''));
  assert.ok(/worklife-backup-.*\.json/.test(res.headers['content-disposition'] || ''));
  const backup = JSON.parse(res.text);
  assert.strictEqual(backup.app, 'worklife-app');
  assert.ok(backup.exportedAt);
  assert.deepStrictEqual(backup.data.today, payload);
  assert.ok(backup.data.ai && backup.data.exercise && backup.data.notes);
});

test('恢复备份会覆盖当前数据', async () => {
  // 先存一份“旧备份”
  const oldPayload = { notes: [{ id: 'n1', text: '旧数据', createdAt: '2026-08-25T00:00:00.000Z' }] };
  const backupBody = JSON.stringify({ app: 'worklife-app', schemaVersion: 1, exportedAt: 'x', data: { notes: oldPayload } });

  // 修改当前数据，制造差异
  const newPayload = { notes: [{ id: 'n2', text: '新数据', createdAt: '2026-08-25T00:00:00.000Z' }] };
  await fetchJSON(base + '/api/data/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPayload),
  });

  // 恢复旧备份
  const restoreRes = await rawRequest(
    { hostname: '127.0.0.1', port: new URL(base).port, path: '/api/restore', method: 'POST' },
    backupBody
  );
  assert.strictEqual(restoreRes.status, 200);
  assert.deepStrictEqual(JSON.parse(restoreRes.text).restored, ['notes']);

  const getRes = await fetchJSON(base + '/api/data');
  assert.deepStrictEqual(getRes.json.notes, oldPayload);
});

test('饮食旧版 meals 数据自动迁移为必吃清单', async () => {
  // 直接写入旧版结构的文件
  const oldFile = path.join(dataDir, 'diet.json');
  fs.writeFileSync(oldFile, JSON.stringify({
    meals: {
      '2026-08-24': { breakfast: '中药\n茶水\n五红粉', lunch: '111', dinner: '111', done: { dinner: false } },
      '2026-08-25': { breakfast: '', lunch: '', dinner: '', done: {} },
    },
  }, null, 2));
  const res = await fetchJSON(base + '/api/data');
  assert.strictEqual(res.status, 200);
  const diet = res.json.diet;
  assert.ok(diet.days, '应迁移为 days 结构');
  assert.deepStrictEqual(diet.defaults, [], '应包含空的每日必吃列表');
  const items = diet.days['2026-08-24'].items || [];
  assert.strictEqual(items.length, 5, '中药/茶水/五红粉/111/111 共 5 项');
  assert.ok(items.some((i) => i.text === '中药'), '应包含中药');
  assert.ok(items.some((i) => i.text === '五红粉'), '应包含五红粉');
  assert.ok(items.some((i) => i.text === '111' && i.done === false), '111 应保留未吃状态');
  assert.ok(!diet.days['2026-08-25'] || !diet.days['2026-08-25'].items, '空日期不应生成清单');
  // 落盘文件也应已是新结构
  const onDisk = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
  assert.ok(onDisk.days, '文件应已迁移为 days 结构');
  assert.ok(Array.isArray(onDisk.defaults), '文件应包含 defaults 列表');
});

test('恢复非法备份返回 400', async () => {
  const bad = [
    '不是 JSON',
    JSON.stringify({ foo: 1 }),
    JSON.stringify({ data: { unknownMod: {} } }),
    JSON.stringify({ data: {} }),
  ];
  for (const body of bad) {
    const res = await rawRequest(
      { hostname: '127.0.0.1', port: new URL(base).port, path: '/api/restore', method: 'POST' },
      body
    );
    assert.strictEqual(res.status, 400, '应当拒绝: ' + body);
  }
});

test('静态页面可访问，路径穿越被拦截', async () => {
  const index = await fetchJSON(base + '/');
  assert.strictEqual(index.status, 200);
  assert.ok(index.text.includes('我的日常'), '首页标题缺失');
  assert.ok(index.text.includes('工作生活 App'), '首页标题缺失');

  const traversal = await rawRequest({
    hostname: '127.0.0.1',
    port: new URL(base).port,
    path: '/..%2Fserver.js',
    method: 'GET',
  });
  assert.ok(traversal.status === 403 || traversal.status === 404, '穿越应被拦截，实际 ' + traversal.status);
});

test('未知接口返回 404', async () => {
  const res = await fetchJSON(base + '/api/nothing');
  assert.strictEqual(res.status, 404);
});
