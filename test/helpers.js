'use strict';
// 共享测试助手：启动本地服务 + 无头浏览器

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER = path.join(__dirname, '..', 'server.js');
const PLAYWRIGHT_PATH = process.env.PLAYWRIGHT_PATH ||
  '/Users/mandychan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function tempDataDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'wl-e2e-'));
}

async function startServer(dataDir) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [SERVER, '0'], {
      env: { ...process.env, DATA_DIR: dataDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const timer = setTimeout(() => reject(new Error('服务启动超时: ' + out)), 10000);
    proc.stdout.on('data', (d) => {
      out += d.toString();
      const m = out.match(/SERVER_READY port=(\d+)/);
      if (m) { clearTimeout(timer); resolve({ proc, port: Number(m[1]) }); }
    });
    proc.stderr.on('data', (d) => { out += d.toString(); });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error('服务提前退出 code=' + code + ' ' + out)); });
  });
}

async function newPage() {
  const { chromium } = require(PLAYWRIGHT_PATH);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  return { browser, page };
}

async function waitFor(fn, timeout = 6000) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeout) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 60));
  }
  throw new Error('等待超时: ' + (lastErr ? lastErr.message : '条件未满足'));
}

async function apiGet(base, moduleName) {
  const url = moduleName ? base + '/api/data/' + moduleName : base + '/api/data';
  const r = await fetch(url);
  return r.json();
}

module.exports = { SERVER, PLAYWRIGHT_PATH, CHROME, tempDataDir, startServer, newPage, waitFor, apiGet };
