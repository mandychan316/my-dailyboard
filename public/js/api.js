'use strict';
// 与本地服务的通信层

const API = {
  async getData() {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('读取数据失败（HTTP ' + res.status + '）');
    return res.json();
  },

  async saveModule(name, payload) {
    const res = await fetch('/api/data/' + encodeURIComponent(name), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('保存失败（HTTP ' + res.status + '）');
    return res.json();
  },

  async restore(bodyText) {
    const res = await fetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyText,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || '恢复失败（HTTP ' + res.status + '）');
    return json;
  },

  backupUrl() {
    return '/api/backup';
  },
};
