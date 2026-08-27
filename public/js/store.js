'use strict';
// 数据缓存 + 自动保存

const Store = (function () {
  const state = { data: null, loaded: false };
  const saveTimers = {};
  const listeners = [];

  function notify() {
    for (const fn of listeners) { try { fn(state.data); } catch (e) { console.error(e); } }
  }

  async function loadAll() {
    state.data = await API.getData();
    state.loaded = true;
    return state.data;
  }

  function onChange(fn) { listeners.push(fn); }

  function genId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  async function saveModule(name) {
    try {
      await API.saveModule(name, state.data[name]);
      return true;
    } catch (e) {
      console.error(e);
      ui.toast('保存失败，请重试');
      return false;
    }
  }

  // 改动数据后防抖自动保存
  function mutate(name, fn, opts) {
    const { notifySave = true } = opts || {};
    if (!state.data[name]) state.data[name] = {};
    fn(state.data[name]);
    clearTimeout(saveTimers[name]);
    saveTimers[name] = setTimeout(() => {
      delete saveTimers[name];
      saveModule(name).then((ok) => { if (ok && notifySave) ui.toast('已保存'); });
    }, 250);
    notify();
  }

  // 立即保存所有待写数据（页面离开前调用）
  async function flushAll() {
    const names = Object.keys(saveTimers);
    for (const n of names) {
      clearTimeout(saveTimers[n]);
      delete saveTimers[n];
      await saveModule(n);
    }
  }

  return { state, loadAll, onChange, genId, saveModule, mutate, flushAll };
})();
