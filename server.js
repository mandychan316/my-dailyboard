#!/usr/bin/env node
'use strict';

// 个人工作生活 App - 本地服务
// 用法: node server.js [端口]   (环境变量 DATA_DIR 可覆盖数据目录，PORT 可指定端口)
// 只监听 127.0.0.1，仅供本机使用。

const http = require('http');
const fs = require('fs');
const path = require('path');

const APP_DIR = __dirname;
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const DEFAULT_DATA_DIR = path.join(APP_DIR, 'data');
const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;
const PORT = Number(process.argv[2] || process.env.PORT || 8765);
const HOST = '127.0.0.1';
const APP_NAME = 'worklife-app';
const SCHEMA_VERSION = 1;
const APP_VERSION = '1.0.0';

const MODULES = ['today', 'ai', 'media', 'exercise', 'diet', 'notes', 'meta'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

// ---------- 数据读写 ----------

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function moduleFile(name) {
  return path.join(DATA_DIR, name + '.json');
}

function defaultModule(name) {
  switch (name) {
    case 'today': return { tasksByDate: {} };
    case 'ai': return { logs: [], prompts: [] };
    case 'media': return { ideas: [], posts: [] };
    case 'exercise': return { weekPlan: {}, checkins: {} };
    case 'diet': return { defaults: [], days: {} };
    case 'notes': return { notes: [] };
    case 'meta': return { schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, createdAt: new Date().toISOString() };
    default: return {};
  }
}

// 饮食数据迁移：旧版 meals(早/午/晚) -> 新版 days(每日执行清单) + defaults(每日必吃)
function migrateDiet(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.days && typeof payload.days === 'object') {
    if (Array.isArray(payload.defaults)) return payload;
    return { defaults: [], days: payload.days };
  }
  if (payload.meals && typeof payload.meals === 'object') {
    const days = {};
    for (const [date, m] of Object.entries(payload.meals)) {
      if (!m || typeof m !== 'object') continue;
      const items = [];
      const done = m.done || {};
      for (const key of ['breakfast', 'lunch', 'dinner']) {
        if (m[key] && String(m[key]).trim()) {
          const isDone = !!done[key];
          for (const line of String(m[key]).split('\n')) {
            const text = line.trim();
            if (text) items.push({ id: 'mig-' + date + '-' + items.length + '-' + Math.random().toString(36).slice(2, 6), text, done: isDone });
          }
        }
      }
      if (items.length) days[date] = { items };
    }
    return { defaults: [], days };
  }
  return payload;
}

function readModule(name) {
  const file = moduleFile(name);
  if (!fs.existsSync(file)) return defaultModule(name);
  try {
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (name === 'diet') {
      const migrated = migrateDiet(payload);
      if (JSON.stringify(migrated) !== JSON.stringify(payload)) writeModule(name, migrated);
      return migrated;
    }
    return payload;
  } catch (e) {
    return defaultModule(name);
  }
}

function writeModule(name, payload) {
  const file = moduleFile(name);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, file); // 原子写入，避免写一半损坏
}

function readAllData() {
  const out = {};
  for (const m of MODULES) out[m] = readModule(m);
  return out;
}

// ---------- 请求处理 ----------

function readBody(req, limit = 50 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function validateBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('备份文件不是有效的 JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('备份文件格式不正确');
  }
  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    throw new Error('备份文件缺少 data 数据');
  }
  const keys = Object.keys(parsed.data);
  const unknown = keys.filter((k) => !MODULES.includes(k));
  if (unknown.length) {
    throw new Error('备份包含未知模块: ' + unknown.join(', '));
  }
  if (!keys.length) {
    throw new Error('备份中没有可恢复的数据');
  }
  return parsed.data;
}

function serveStatic(req, res, rawUrl) {
  let p;
  try {
    p = decodeURIComponent(rawUrl.split('?')[0]);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }
  if (p === '/') p = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, p));
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

function handleApi(req, res, rawUrl) {
  const u = new URL(rawUrl, 'http://' + HOST);
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'api') {
    serveStatic(req, res, rawUrl);
    return;
  }
  const method = req.method;

  // GET /api/health
  if (parts[1] === 'health' && parts.length === 2 && method === 'GET') {
    sendJSON(res, 200, {
      ok: true,
      name: APP_NAME,
      version: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      dataDir: DATA_DIR,
    });
    return;
  }

  // GET /api/data
  if (parts[1] === 'data' && parts.length === 2 && method === 'GET') {
    sendJSON(res, 200, readAllData());
    return;
  }

  // PUT /api/data/:module
  if (parts[1] === 'data' && parts.length === 3 && method === 'PUT') {
    const m = parts[2];
    if (!MODULES.includes(m)) {
      sendJSON(res, 404, { ok: false, error: '未知模块: ' + m });
      return;
    }
    readBody(req)
      .then((buf) => {
        let payload;
        try {
          payload = JSON.parse(buf.toString('utf8'));
        } catch (e) {
          return sendJSON(res, 400, { ok: false, error: 'JSON 格式错误' });
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          return sendJSON(res, 400, { ok: false, error: '数据必须是对象' });
        }
        writeModule(m, payload);
        sendJSON(res, 200, { ok: true, module: m, updatedAt: new Date().toISOString() });
      })
      .catch((e) => sendJSON(res, 400, { ok: false, error: e.message }));
    return;
  }

  // GET /api/backup
  if (parts[1] === 'backup' && parts.length === 2 && method === 'GET') {
    const backup = {
      app: APP_NAME,
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data: readAllData(),
    };
    const ts = backup.exportedAt.replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
    const filename = 'worklife-backup-' + ts + '.json';
    const body = JSON.stringify(backup, null, 2);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    res.end(body);
    return;
  }

  // POST /api/restore
  if (parts[1] === 'restore' && parts.length === 2 && method === 'POST') {
    readBody(req)
      .then((buf) => {
        let data;
        try {
          data = validateBackup(buf.toString('utf8'));
        } catch (e) {
          return sendJSON(res, 400, { ok: false, error: e.message });
        }
        for (const m of Object.keys(data)) writeModule(m, data[m]);
        sendJSON(res, 200, { ok: true, restored: Object.keys(data) });
      })
      .catch((e) => sendJSON(res, 400, { ok: false, error: e.message }));
    return;
  }

  sendJSON(res, 404, { ok: false, error: '接口不存在' });
}

// ---------- 启动 ----------

ensureDataDir();
for (const m of MODULES) {
  const f = moduleFile(m);
  if (!fs.existsSync(f)) writeModule(m, defaultModule(m));
}

const server = http.createServer((req, res) => handleApi(req, res, req.url));
server.listen(PORT, HOST, () => {
  const actual = server.address().port;
  console.log('SERVER_READY port=' + actual + ' dataDir=' + DATA_DIR);
});
server.on('error', (err) => {
  console.error('SERVER_ERROR ' + err.message);
  process.exit(1);
});
