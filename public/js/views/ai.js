'use strict';
// AI实践：使用日志 + 提示词模板库

const AIView = {
  state: { tab: 'logs', purpose: 'all', tool: 'all', category: 'all' },
  PURPOSES: ['写代码', '写文案', '学习', '生活', '其他'],
  CATEGORIES: ['写作', '编程', '学习', '生活', '其他'],
  TOOL_SUGGESTIONS: ['ChatGPT', 'Claude', 'Codex', 'DeepSeek', 'Kimi', 'Gemini', '豆包', '通义', '文心一言'],

  render(main) {
    const page = ui.el('div', { class: 'page' });
    const container = ui.el('div');
    page.appendChild(container);
    main.appendChild(page);
    this.refresh(container);
  },

  refresh(container) {
    container.innerHTML = '';
    container.appendChild(ui.el('div', { class: 'page-head' }, [
      ui.el('h1', { class: 'page-title', text: 'AI实践' }),
      ui.el('div', { class: 'page-sub', text: '用过的都值得记一笔，好用的模板随时取用' }),
    ]));
    container.appendChild(this.tabs(container));
    if (this.state.tab === 'logs') container.appendChild(this.logsView(container));
    else container.appendChild(this.promptsView(container));
  },

  tabs(container) {
    const tabs = ui.el('div', { class: 'tabs' });
    const make = (key, label) =>
      ui.el('button', { class: 'tab' + (this.state.tab === key ? ' active' : ''), text: label, onclick: () => { this.state.tab = key; this.refresh(container); } });
    tabs.appendChild(make('logs', '使用日志'));
    tabs.appendChild(make('prompts', '提示词库'));
    return tabs;
  },

  /* ---------- 使用日志 ---------- */

  logsView(container) {
    const data = Store.state.data.ai;
    const logs = this.filteredLogs(data);
    const wrap = ui.el('div');

    const purpose = ui.el('select', {}, [ui.el('option', { value: 'all', text: '全部用途' })].concat(
      this.PURPOSES.map((p) => ui.el('option', { value: p, text: p }))
    ));
    purpose.value = this.state.purpose;
    purpose.addEventListener('change', () => { this.state.purpose = purpose.value; this.refresh(container); });

    const tools = Array.from(new Set((data.logs || []).map((l) => l.tool).filter(Boolean))).sort();
    const tool = ui.el('select', {}, [ui.el('option', { value: 'all', text: '全部工具' })].concat(
      tools.map((t) => ui.el('option', { value: t, text: t }))
    ));
    tool.value = this.state.tool;
    tool.addEventListener('change', () => { this.state.tool = tool.value; this.refresh(container); });

    const addBtn = ui.el('button', { class: 'btn btn-primary', html: ui.icon('plus') + '记录一次', onclick: () => this.logForm(container, null) });

    wrap.appendChild(ui.el('div', { class: 'filter-bar' }, [purpose, tool, ui.el('div', { style: 'flex:1' }), addBtn]));

    const list = ui.el('div');
    if (!logs.length) {
      list.appendChild(ui.el('div', { class: 'empty', text: '还没有记录，记下第一次和 AI 的协作吧' }));
    } else {
      for (const log of logs) list.appendChild(this.logCard(data, log, container));
    }
    wrap.appendChild(list);
    return wrap;
  },

  filteredLogs(data) {
    let logs = (data.logs || []).slice();
    if (this.state.purpose !== 'all') logs = logs.filter((l) => l.purpose === this.state.purpose);
    if (this.state.tool !== 'all') logs = logs.filter((l) => l.tool === this.state.tool);
    logs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    return logs;
  },

  logCard(data, log, container) {
    const card = ui.el('div', { class: 'item-card' }, [
      ui.el('div', { class: 'ic-top' }, [
        ui.el('div', { style: 'flex:1;min-width:0' }, [
          ui.el('div', { class: 'ic-foot', style: 'margin-top:0' }, [
            ui.el('span', { class: 'chip', text: log.date }),
            log.purpose ? ui.el('span', { class: 'chip plain', text: log.purpose }) : null,
            log.tool ? ui.el('span', { class: 'chip plain', text: log.tool }) : null,
          ]),
        ]),
        ui.el('div', { class: 'ic-actions' }, [
          ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('edit'), title: '编辑', onclick: () => this.logForm(container, log) }),
          ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('trash'), title: '删除', onclick: () => this.deleteLog(data, log, container) }),
        ]),
      ]),
      log.content ? ui.el('div', { class: 'ic-body' }, [
        ui.el('strong', { text: '做了什么　' }), document.createTextNode(log.content),
      ]) : null,
      log.reflection ? ui.el('div', { class: 'ic-body' }, [
        ui.el('strong', { text: '心得　' }), document.createTextNode(log.reflection),
      ]) : null,
    ]);
    return card;
  },

  logForm(container, log) {
    const date = ui.el('input', { type: 'date', value: log ? log.date : Dates.todayStr() });
    const purpose = ui.el('select', {}, this.PURPOSES.map((p) => ui.el('option', { value: p, text: p })));
    purpose.value = log ? (log.purpose || this.PURPOSES[0]) : this.PURPOSES[0];
    const tool = ui.el('input', { type: 'text', list: 'tool-list', value: log ? (log.tool || '') : '', placeholder: '如 ChatGPT / Claude / Codex' });
    const content = ui.el('textarea', { rows: 3, placeholder: '用 AI 做了什么？' }, [log ? (log.content || '') : '']);
    const reflection = ui.el('textarea', { rows: 2, placeholder: '结果如何？有什么心得？（可选）' }, [log ? (log.reflection || '') : '']);

    const root = document.getElementById('modal-root');
    const overlay = ui.el('div', { class: 'modal-overlay' });
    const datalist = ui.el('datalist', { id: 'tool-list' }, this.TOOL_SUGGESTIONS.map((t) => ui.el('option', { value: t })));
    const box = ui.el('div', { class: 'modal form-modal' }, [
      ui.el('div', { class: 'modal-title', text: log ? '编辑日志' : '记录一次 AI 使用' }),
      ui.el('div', { class: 'field-row' }, [
        ui.el('label', { class: 'field' }, [ui.el('span', { text: '日期' }), date]),
        ui.el('label', { class: 'field' }, [ui.el('span', { text: '用途' }), purpose]),
      ]),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '用的什么工具' }), tool, datalist]),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '做了什么' }), content]),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '结果与心得' }), reflection]),
      ui.el('div', { class: 'modal-actions' }, [
        ui.el('button', { class: 'btn', text: '取消', onclick: () => overlay.remove() }),
        ui.el('button', {
          class: 'btn btn-primary', text: '保存',
          onclick: () => {
            if (!content.value.trim()) { ui.toast('请写下做了什么', 'warn'); return; }
            Store.mutate('ai', (m) => {
              if (log) {
                const x = m.logs.find((y) => y.id === log.id);
                if (x) { x.date = date.value; x.purpose = purpose.value; x.tool = tool.value.trim(); x.content = content.value.trim(); x.reflection = reflection.value.trim(); }
              } else {
                m.logs.push({ id: Store.genId(), date: date.value, purpose: purpose.value, tool: tool.value.trim(), content: content.value.trim(), reflection: reflection.value.trim(), createdAt: new Date().toISOString() });
              }
            });
            overlay.remove();
            this.refresh(container);
          },
        }),
      ]),
    ]);
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    root.appendChild(overlay);
  },

  async deleteLog(data, log, container) {
    const ok = await ui.confirmDialog('删除日志', '确定删除这条使用记录吗？');
    if (!ok) return;
    Store.mutate('ai', (m) => { m.logs = m.logs.filter((x) => x.id !== log.id); });
    this.refresh(container);
  },

  /* ---------- 提示词库 ---------- */

  promptsView(container) {
    const data = Store.state.data.ai;
    const prompts = this.filteredPrompts(data);
    const wrap = ui.el('div');

    const cats = Array.from(new Set([...this.CATEGORIES, ...(data.prompts || []).map((p) => p.category).filter(Boolean)])).sort((a, b) => {
      const ia = this.CATEGORIES.indexOf(a), ib = this.CATEGORIES.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    const chips = ui.el('div', { class: 'filter-bar' });
    const makeChip = (cat) =>
      ui.el('button', {
        class: 'chip' + (this.state.category === cat ? ' on' : ''),
        style: 'border:none;cursor:pointer;background:' + (this.state.category === cat ? 'var(--primary)' : ''),
        text: cat,
        onclick: () => { this.state.category = this.state.category === cat ? 'all' : cat; this.refresh(container); },
      });
    chips.appendChild(makeChip('全部'));
    for (const c of cats) chips.appendChild(makeChip(c));
    chips.appendChild(ui.el('div', { style: 'flex:1' }));
    chips.appendChild(ui.el('button', { class: 'btn btn-primary', html: ui.icon('plus') + '新增模板', onclick: () => this.promptForm(container, null) }));
    wrap.appendChild(chips);

    const list = ui.el('div');
    if (!prompts.length) {
      list.appendChild(ui.el('div', { class: 'empty', text: '还没有模板，把好用的提问模板存下来吧' }));
    } else {
      for (const p of prompts) list.appendChild(this.promptCard(data, p, container));
    }
    wrap.appendChild(list);
    return wrap;
  },

  filteredPrompts(data) {
    let prompts = (data.prompts || []).slice();
    if (this.state.category !== 'all') prompts = prompts.filter((p) => p.category === this.state.category);
    prompts.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return prompts;
  },

  promptCard(data, p, container) {
    const card = ui.el('div', { class: 'item-card' }, [
      ui.el('div', { class: 'ic-top' }, [
        ui.el('div', { style: 'flex:1;min-width:0' }, [
          p.category ? ui.el('span', { class: 'chip', text: p.category }) : null,
          ui.el('span', { class: 'ic-title', style: 'margin-left:8px', text: p.title }),
        ]),
        ui.el('div', { class: 'ic-actions' }, [
          ui.el('button', { class: 'btn btn-sm', html: ui.icon('copy') + '复制', onclick: () => this.copyPrompt(p.content) }),
          ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('edit'), title: '编辑', onclick: () => this.promptForm(container, p) }),
          ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('trash'), title: '删除', onclick: () => this.deletePrompt(data, p, container) }),
        ]),
      ]),
      ui.el('div', { class: 'ic-body', text: p.content }),
      (p.scene || p.effect) ? ui.el('div', { class: 'ic-foot' }, [
        p.scene ? ui.el('span', { class: 'chip plain', text: '适用：' + p.scene }) : null,
        p.effect ? ui.el('span', { class: 'chip plain', text: '效果：' + p.effect }) : null,
      ]) : null,
    ]);
    return card;
  },

  async copyPrompt(content) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
        ui.toast('已复制到剪贴板');
        return;
      }
    } catch (e) { /* 走降级方案 */ }
    const ta = document.createElement('textarea');
    ta.value = content;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); ui.toast('已复制到剪贴板'); } catch (e) { ui.toast('复制失败，请手动选择复制', 'warn'); }
    ta.remove();
  },

  promptForm(container, p) {
    const category = ui.el('select', {}, this.CATEGORIES.map((c) => ui.el('option', { value: c, text: c })));
    category.value = p ? (p.category || this.CATEGORIES[0]) : this.CATEGORIES[0];
    const title = ui.el('input', { type: 'text', value: p ? (p.title || '') : '', placeholder: '模板名称，如：周报总结助手' });
    const content = ui.el('textarea', { rows: 6, placeholder: '把完整的提示词写在这里' }, [p ? (p.content || '') : '']);
    const scene = ui.el('input', { type: 'text', value: p ? (p.scene || '') : '', placeholder: '什么时候用（可选）' });
    const effect = ui.el('input', { type: 'text', value: p ? (p.effect || '') : '', placeholder: '效果怎么样（可选）' });

    const root = document.getElementById('modal-root');
    const overlay = ui.el('div', { class: 'modal-overlay' });
    const box = ui.el('div', { class: 'modal form-modal' }, [
      ui.el('div', { class: 'modal-title', text: p ? '编辑模板' : '新增模板' }),
      ui.el('div', { class: 'field-row' }, [
        ui.el('label', { class: 'field' }, [ui.el('span', { text: '分类' }), category]),
        ui.el('label', { class: 'field' }, [ui.el('span', { text: '标题' }), title]),
      ]),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '提示词内容' }), content]),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '适用场景' }), scene]),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '效果备注' }), effect]),
      ui.el('div', { class: 'modal-actions' }, [
        ui.el('button', { class: 'btn', text: '取消', onclick: () => overlay.remove() }),
        ui.el('button', {
          class: 'btn btn-primary', text: '保存',
          onclick: () => {
            if (!title.value.trim() || !content.value.trim()) { ui.toast('标题和内容都要填', 'warn'); return; }
            Store.mutate('ai', (m) => {
              if (p) {
                const x = m.prompts.find((y) => y.id === p.id);
                if (x) { x.category = category.value; x.title = title.value.trim(); x.content = content.value.trim(); x.scene = scene.value.trim(); x.effect = effect.value.trim(); }
              } else {
                m.prompts.push({ id: Store.genId(), category: category.value, title: title.value.trim(), content: content.value.trim(), scene: scene.value.trim(), effect: effect.value.trim(), createdAt: new Date().toISOString() });
              }
            });
            overlay.remove();
            this.refresh(container);
          },
        }),
      ]),
    ]);
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    root.appendChild(overlay);
  },

  async deletePrompt(data, p, container) {
    const ok = await ui.confirmDialog('删除模板', '确定删除「' + p.title + '」吗？');
    if (!ok) return;
    Store.mutate('ai', (m) => { m.prompts = m.prompts.filter((x) => x.id !== p.id); });
    this.refresh(container);
  },
};
