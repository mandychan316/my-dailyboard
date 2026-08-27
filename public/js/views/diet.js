'use strict';
// 饮食计划：每天记录必吃内容 + 打勾是否吃过（不区分早中晚）

const DietView = {
  _copyBuffer: null,

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
      ui.el('h1', { class: 'page-title', text: '饮食计划' }),
      ui.el('div', { class: 'page-sub', text: '把每天必吃的内容记下来，吃过就打个勾' }),
    ]));
    container.appendChild(this.todayBanner());
    container.appendChild(this.weekGrid(container));
  },

  todayBanner() {
    const today = Dates.todayStr();
    const span = ui.el('span', { class: 'diet-today-banner' });
    const update = () => {
      const day = (Store.state.data.diet.days || {})[today] || {};
      const items = day.items || [];
      span.textContent = items.length
        ? items.map((i) => (i.done ? '✓ ' : '· ') + i.text).join('　')
        : '还没安排必吃清单';
    };
    update();
    this._bannerUpdate = update;
    return ui.el('div', { class: 'card', style: 'padding:12px 18px;margin-bottom:14px;font-size:13px' }, [
      ui.el('strong', { text: '今天必吃　' }),
      span,
    ]);
  },

  weekGrid(container) {
    const data = Store.state.data.diet;
    const days = data.days || {};
    const today = Dates.todayStr();
    const week = Dates.weekDays(today);
    const grid = ui.el('div', { class: 'diet-week' });
    for (const d of week) {
      const day = days[d] || {};
      const items = day.items || [];
      const isToday = d === today;
      const doneCount = items.filter((i) => i.done).length;

      const head = ui.el('div', { class: 'dw-head' + (isToday ? ' today' : '') }, [
        ui.el('span', { class: 'dw-day', text: Dates.weekdayCN(d).replace('星期', '周') + ' ' + d.slice(5) }),
        isToday ? ui.el('span', { class: 'chip done', text: '今天' }) : null,
        ui.el('span', { class: 'dw-count', text: items.length ? doneCount + '/' + items.length : '' }),
      ]);

      const list = ui.el('div', { class: 'dw-items' });
      if (!items.length) {
        list.appendChild(ui.el('div', { class: 'hint', style: 'padding:4px 2px;color:var(--ink-faint)', text: '还没有必吃内容' }));
      } else {
        for (const item of items) list.appendChild(this.itemRow(item, d, container));
      }

      const input = ui.el('input', { type: 'text', placeholder: '添加必吃…' });
      const addBtn = ui.el('button', { class: 'btn btn-sm btn-primary', text: '添加', onclick: () => this.addItem(d, input, container) });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addItem(d, input, container); });

      const ops = ui.el('div', { class: 'dw-ops' }, [
        ui.el('button', { class: 'btn btn-ghost btn-sm', text: '复制', title: '复制这一天的必吃清单', onclick: () => this.copyDay(d) }),
        ui.el('button', { class: 'btn btn-ghost btn-sm', text: '粘贴', title: '用复制的清单覆盖这一天', onclick: () => this.pasteDay(d, container) }),
      ]);

      grid.appendChild(ui.el('div', { class: 'card dw-card' + (isToday ? ' today' : ''), 'data-date': d }, [
        head,
        list,
        ui.el('div', { class: 'dw-add' }, [input, addBtn]),
        ops,
      ]));
    }
    return grid;
  },

  itemRow(item, d, container) {
    const row = ui.el('div', { class: 'dw-item' + (item.done ? ' done' : '') }, [
      ui.el('button', {
        class: 'dw-check' + (item.done ? ' on' : ''),
        html: item.done ? ui.icon('check') : '',
        'data-date': d,
        'data-item': item.id,
        title: item.done ? '标记为没吃' : '标记为吃过',
        onclick: () => this.toggleItem(d, item.id, container),
      }),
      ui.el('span', { class: 'dw-text', text: item.text }),
      ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('trash'), title: '删除', onclick: () => this.removeItem(d, item.id, container) }),
    ]);
    return row;
  },

  toggleItem(d, id, container) {
    Store.mutate('diet', (m) => {
      const items = (m.days[d] && m.days[d].items) || [];
      const it = items.find((x) => x.id === id);
      if (it) it.done = !it.done;
    });
    this.refresh(container);
  },

  addItem(d, input, container) {
    const t = input.value.trim();
    if (!t) { ui.toast('写点内容再添加吧', 'warn'); return; }
    Store.mutate('diet', (m) => {
      if (!m.days[d]) m.days[d] = { items: [] };
      m.days[d].items.push({ id: Store.genId(), text: t, done: false });
    });
    if (d === Dates.todayStr() && this._bannerUpdate) this._bannerUpdate();
    this.refresh(container);
    const nextInput = container.querySelector('.dw-card[data-date="' + d + '"] .dw-add input');
    if (nextInput) nextInput.focus();
  },

  async removeItem(d, id, container) {
    const ok = await ui.confirmDialog('删除必吃项', '确定删除这一项吗？');
    if (!ok) return;
    Store.mutate('diet', (m) => {
      if (m.days[d]) m.days[d].items = m.days[d].items.filter((x) => x.id !== id);
    });
    this.refresh(container);
  },

  copyDay(d) {
    const day = (Store.state.data.diet.days || {})[d] || {};
    this._copyBuffer = (day.items || []).map((i) => ({ text: i.text, done: i.done }));
    ui.toast('已复制 ' + (d === Dates.todayStr() ? '今天' : d.slice(5)) + ' 的必吃清单');
  },

  pasteDay(d, container) {
    if (!this._copyBuffer || !this._copyBuffer.length) { ui.toast('先复制某天的必吃清单', 'warn'); return; }
    Store.mutate('diet', (m) => {
      m.days[d] = { items: this._copyBuffer.map((i) => ({ id: Store.genId(), text: i.text, done: i.done })) };
    });
    this.refresh(container);
    ui.toast('已粘贴到 ' + (d === Dates.todayStr() ? '今天' : d.slice(5)));
  },
};
