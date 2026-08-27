'use strict';
// 饮食计划：每日必吃模板 + 本周执行（勾选/删除）+ 打卡日历

const DietView = {
  state: { weekDate: null },

  render(main) {
    const page = ui.el('div', { class: 'page' });
    const container = ui.el('div');
    page.appendChild(container);
    main.appendChild(page);
    this.refresh(container);
  },

  refresh(container) {
    this._container = container;
    if (!this.state.weekDate) this.state.weekDate = Dates.todayStr();
    container.innerHTML = '';
    container.appendChild(ui.el('div', { class: 'page-head' }, [
      ui.el('h1', { class: 'page-title', text: '饮食计划' }),
      ui.el('div', { class: 'page-sub', text: '定好每日必吃，本周每天照着吃，吃过就打个勾' }),
    ]));
    container.appendChild(this.defaultsCard(container));
    container.appendChild(this.weekCard(container));
  },

  /* ---------- 每日必吃（本周模板） ---------- */

  defaultsCard(container) {
    const defaults = Store.state.data.diet.defaults || [];
    const list = ui.el('div', { class: 'dw-items' });
    const renderList = () => {
      list.innerHTML = '';
      if (!defaults.length) {
        list.appendChild(ui.el('div', { class: 'hint', style: 'padding:4px 2px;color:var(--ink-faint)', text: '还没有必吃内容，添加后本周每天会自动带上' }));
        return;
      }
      for (const it of defaults) {
        list.appendChild(ui.el('div', { class: 'dw-item' }, [
          ui.el('span', { class: 'dw-text', text: it.text }),
          ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('trash'), title: '删除', onclick: () => this.removeDefault(it.id, container) }),
        ]));
      }
    };
    renderList();
    const input = ui.el('input', { type: 'text', id: 'diet-default-input', placeholder: '添加每日必吃，如：中药' });
    const btn = ui.el('button', { class: 'btn btn-primary', text: '添加', onclick: () => this.addDefault(input, container) });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addDefault(input, container); });
    return ui.el('div', { class: 'card' }, [
      ui.el('div', { class: 'card-title' }, ['每日必吃', ui.el('small', { text: '添加后本周每天自动带上' })]),
      ui.el('div', { class: 'dw-add' }, [input, btn]),
      list,
    ]);
  },

  addDefault(input, container) {
    const t = input.value.trim();
    if (!t) { ui.toast('写点内容再添加吧', 'warn'); return; }
    Store.mutate('diet', (m) => {
      if (!m.defaults) m.defaults = [];
      if (!m.defaults.some((i) => i.text === t)) m.defaults.push({ id: Store.genId(), text: t });
      // 自动添加到本周每天
      const week = Dates.weekDays(Dates.todayStr());
      for (const d of week) {
        if (!m.days[d]) m.days[d] = { items: [] };
        if (!m.days[d].items.some((i) => i.text === t)) {
          m.days[d].items.push({ id: Store.genId(), text: t, done: false });
        }
      }
    });
    input.value = '';
    this.refresh(container);
    const nextInput = document.getElementById('diet-default-input');
    if (nextInput) nextInput.focus();
  },

  async removeDefault(id, container) {
    const ok = await ui.confirmDialog('删除必吃项', '只从「每日必吃」里删除，本周已生成的安排会保留。确定删除吗？');
    if (!ok) return;
    Store.mutate('diet', (m) => { m.defaults = (m.defaults || []).filter((x) => x.id !== id); });
    this.refresh(container);
  },

  /* ---------- 本周执行 ---------- */

  weekCard(container) {
    const data = Store.state.data.diet;
    const days = data.days || {};
    const today = Dates.todayStr();
    const weekDate = this.state.weekDate || today;
    const week = Dates.weekDays(weekDate);

    const titleRight = ui.el('div', { style: 'display:flex;align-items:center;gap:8px' }, [
      weekDate !== today ? ui.el('button', { class: 'btn btn-sm', text: '回到本周', onclick: () => { this.state.weekDate = today; this.refresh(container); } }) : null,
      ui.el('button', { class: 'btn btn-ghost btn-sm', title: '打开日历', html: ui.icon('calendar'), onclick: () => this.openCalendar() }),
    ]);
    const card = ui.el('div', { class: 'card' }, [
      ui.el('div', { class: 'card-title' }, [
        '本周打卡',
        ui.el('small', { text: weekDate === today ? ('从 ' + Dates.weekStart(today) + ' 开始的一周') : ('正在查看 ' + Dates.weekStart(weekDate) + ' 开始的一周') }),
        titleRight,
      ]),
    ]);
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
        list.appendChild(ui.el('div', { class: 'hint', style: 'padding:4px 2px;color:var(--ink-faint)', text: '还没有应吃内容' }));
      } else {
        for (const item of items) list.appendChild(this.itemRow(item, d, container));
      }
      const input = ui.el('input', { type: 'text', placeholder: '当天额外加…' });
      const addBtn = ui.el('button', { class: 'btn btn-sm btn-primary', text: '添加', onclick: () => this.addItem(d, input, container) });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addItem(d, input, container); });
      grid.appendChild(ui.el('div', { class: 'card dw-card' + (isToday ? ' today' : ''), 'data-date': d }, [head, list, ui.el('div', { class: 'dw-add' }, [input, addBtn])]));
    }
    card.appendChild(grid);
    return card;
  },

  itemRow(item, d, container) {
    return ui.el('div', { class: 'dw-item' + (item.done ? ' done' : '') }, [
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
    this.refresh(container);
    const nextInput = container.querySelector('.dw-card[data-date="' + d + '"] .dw-add input');
    if (nextInput) nextInput.focus();
  },

  async removeItem(d, id, container) {
    const ok = await ui.confirmDialog('删除应吃项', '确定删除这一项吗？');
    if (!ok) return;
    Store.mutate('diet', (m) => {
      if (m.days[d]) m.days[d].items = m.days[d].items.filter((x) => x.id !== id);
    });
    this.refresh(container);
  },

  /* ---------- 日历 ---------- */

  openCalendar() {
    const data = Store.state.data.diet;
    const days = data.days || {};
    const marks = {};
    for (const d of Object.keys(days)) {
      const items = (days[d] && days[d].items) || [];
      if (items.some((i) => i.done)) marks[d] = true;
    }
    Calendar.open({
      title: '饮食打卡日历',
      marks,
      tooltip: (dateStr) => {
        const items = (days[dateStr] && days[dateStr].items) || [];
        if (!items.length) return null;
        const lines = [Dates.formatCN(dateStr)];
        for (const it of items) lines.push((it.done ? '✓ ' : '· ') + it.text);
        return lines.join('\n');
      },
      onPick: (dateStr) => {
        this.state.weekDate = dateStr;
        this.refresh(this._container);
      },
    });
  },
};
