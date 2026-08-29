'use strict';
// 设置：数据位置、备份导出、恢复导入、使用说明

const SettingsView = {
  THEMES: [
    { key: 'warm', name: '暖色手账', desc: '青白底 · 黛青主色 · 暖橙点缀（默认）', colors: ['#F1F4F1', '#416B5D', '#D97B5F'] },
    { key: 'mint', name: '薄荷晨光', desc: '清新自然，像清晨瑜伽室', colors: ['#F4FAF7', '#2F6B5C', '#D9A441'] },
    { key: 'dark', name: '深夜墨蓝', desc: '暗色模式，夜间使用更舒适', colors: ['#1B2430', '#7FB4E6', '#E6C36A'] },
    { key: 'editorial', name: '编辑部黑白', desc: '极简黑白，杂志排版感', colors: ['#FFFFFF', '#1D4ED8', '#111111'] },
    { key: 'cream', name: '暖阳奶油', desc: '复古温暖，奶油米白', colors: ['#F7F1E3', '#8B6F47', '#D9784A'] },
  ],

  async render(main) {
    const page = ui.el('div', { class: 'page' });
    const container = ui.el('div');
    page.appendChild(container);
    main.appendChild(page);

    let dataDir = '正在读取…';
    try {
      const res = await fetch('/api/health');
      const j = await res.json();
      dataDir = j.dataDir || dataDir;
    } catch (e) { /* 保持默认文案 */ }

    container.appendChild(ui.el('div', { class: 'page-head' }, [
      ui.el('h1', { class: 'page-title', text: '设置与备份' }),
      ui.el('div', { class: 'page-sub', text: '数据都在自己电脑上，随时可以备份和恢复' }),
    ]));

    container.appendChild(ui.el('div', { class: 'card' }, [
      ui.el('div', { class: 'card-title' }, ['数据位置']),
      ui.el('div', { class: 'path-box', text: dataDir }),
      ui.el('div', { class: 'hint', style: 'margin-top:8px', text: '所有数据以 JSON 文件形式保存在这个文件夹里，可以直接复制整个文件夹来备份。' }),
    ]));

    container.appendChild(this.themeCard());

    const backupCard = ui.el('div', { class: 'card' }, [
      ui.el('div', { class: 'card-title' }, ['备份与恢复']),
      ui.el('div', { class: 'setting-item' }, [
        ui.el('div', {}, [
          ui.el('div', { class: 'si-title', text: '导出备份' }),
          ui.el('div', { class: 'si-desc', text: '把全部数据打包成一个文件，保存到电脑任意位置。' }),
        ]),
        ui.el('button', { class: 'btn btn-primary', text: '导出备份', onclick: () => { window.location.href = API.backupUrl(); } }),
      ]),
      ui.el('div', { class: 'setting-item' }, [
        ui.el('div', {}, [
          ui.el('div', { class: 'si-title', text: '恢复备份' }),
          ui.el('div', { class: 'si-desc', text: '选择之前导出的备份文件，恢复后会覆盖当前全部数据。' }),
        ]),
        ui.el('label', { class: 'btn', style: 'cursor:pointer', text: '选择文件…' }, [
          ui.el('input', {
            type: 'file',
            accept: '.json,application/json',
            style: 'display:none',
            onchange: (e) => this.restore(e.target.files[0]),
          }),
        ]),
      ]),
    ]);
    container.appendChild(backupCard);

    container.appendChild(ui.el('div', { class: 'card' }, [
      ui.el('div', { class: 'card-title' }, ['使用说明']),
      ui.el('div', { class: 'hint', style: 'line-height:2;white-space:pre-line', text: '① 双击「启动.command」打开 App\n② 所有改动自动保存，不用手动保存\n③ 想备份就点「导出备份」，想换数据就「恢复备份」\n④ 直接复制 data 文件夹，也是一种备份方式' }),
    ]));
  },

  themeCard() {
    const options = ui.el('div', { class: 'theme-options' });
    const refresh = () => {
      options.innerHTML = '';
      const current = (Store.state.data.preferences && Store.state.data.preferences.theme) || 'warm';
      for (const t of this.THEMES) {
        const swatches = ui.el('div', { class: 't-swatches' }, t.colors.map((c) => ui.el('i', { style: 'background:' + c })));
        options.appendChild(ui.el('button', {
          class: 'theme-opt' + (t.key === current ? ' active' : ''),
          'data-theme': t.key,
          onclick: () => {
            document.documentElement.setAttribute('data-theme', t.key);
            Store.mutate('preferences', (p) => { p.theme = t.key; });
            refresh();
          },
        }, [
          ui.el('div', { class: 't-name', text: t.name }),
          ui.el('div', { class: 't-desc', text: t.desc }),
          swatches,
        ]));
      }
    };
    refresh();
    return ui.el('div', { class: 'card' }, [
      ui.el('div', { class: 'card-title' }, ['界面风格', ui.el('small', { text: '选择后立即生效并自动保存' })]),
      options,
    ]);
  },

  async restore(file) {
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch (e) {
      ui.toast('读取文件失败', 'warn');
      return;
    }
    const ok = await ui.confirmDialog('恢复备份', '恢复会用备份覆盖当前全部数据，且无法撤销。确定继续吗？', { confirmText: '覆盖并恢复' });
    if (!ok) return;
    try {
      await API.restore(text);
      ui.toast('恢复成功，正在刷新…');
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      ui.toast(e.message || '恢复失败，请检查文件', 'warn');
    }
  },
};
