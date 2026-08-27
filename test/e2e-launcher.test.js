'use strict';
// 启动器验收：自动找端口、启动服务、打开浏览器地址

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const APP = path.join(__dirname, '..');
const LAUNCHER = path.join(APP, '启动.command');

test('双击启动器：启动服务并打开浏览器', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-launch-'));
  const fakeOpen = path.join(tmp, 'open');
  const openedFile = path.join(tmp, 'opened.txt');
  fs.writeFileSync(fakeOpen, '#!/bin/zsh\necho "$@" > "' + openedFile + '"\n');
  fs.chmodSync(fakeOpen, 0o755);

  const res = spawnSync('/bin/zsh', [LAUNCHER], {
    env: { ...process.env, PATH: tmp + ':' + process.env.PATH },
    cwd: APP,
    timeout: 20000,
  });
  assert.strictEqual(res.status, 0, '启动器退出码异常: ' + (res.stderr || '').toString());

  // 假 open 收到本地地址
  const opened = fs.readFileSync(openedFile, 'utf8').trim();
  assert.ok(opened.startsWith('http://127.0.0.1:'), 'open 参数: ' + opened);
  const port = Number(opened.split(':').pop());

  // 服务已就绪
  let health = null;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/api/health');
      health = await r.json();
      break;
    } catch (e) { await new Promise((r) => setTimeout(r, 200)); }
  }
  assert.ok(health && health.ok === true, '服务未就绪');

  // 数据文件已生成
  assert.ok(fs.existsSync(path.join(APP, 'data', 'today.json')), 'data/today.json 应存在');
  assert.ok(fs.existsSync(path.join(APP, 'data', 'server.log')), 'data/server.log 应存在');
  assert.ok(fs.existsSync(path.join(APP, 'data', 'server.pid')), 'data/server.pid 应存在');

  // 清理：结束启动的服务
  const pid = Number(fs.readFileSync(path.join(APP, 'data', 'server.pid'), 'utf8').trim());
  try { process.kill(pid, 'SIGTERM'); } catch (e) { /* 可能已退出 */ }
  await new Promise((r) => setTimeout(r, 400));
});
