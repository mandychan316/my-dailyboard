'use strict';
// 饮食计划：整周三餐安排 + 复制到另一天 + 吃完打勾

const DietView = {
  _copyBuffer: null,
  MEAL_KEYS: ['breakfast', 'lunch', 'dinner'],
  MEAL_LABELS: ['早', '午', '晚'],

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
      ui.el('div', { class: 'page-sub', text: '提前想好每天吃什么，照着吃，不纠结' }),
    ]));
    container.appendChild(this.todayBanner());
    container.appendChild(this.weekGrid(container));
  },

  todayBanner() {
    const today = Dates.todayStr();
    const span = ui.el('span', { class: 'diet-today-banner' });
    const update = () => {
      const m = (Store.state.data.diet.meals || {})[today] || {};
      const parts = this.MEAL_KEYS.map((k, i) => this.MEAL_LABELS[i] + ' ' + (m[k] ? m[k] : '—')).join('　');
      span.textContent = parts;
    };
    update();
    this._bannerUpdate = update;
    return ui.el('div', { class: 'card', style: 'padding:12px 18px;margin-bottom:14px;font-size:13px' }, [
      ui.el('strong', { text: '今天吃什么　' }),
      span,
    ]);
  },

  weekGrid(container) {
    const data = Store.state.data.diet;
    const meals = data.meals || {};
    const today = Dates.todayStr();
    const days = Dates.weekDays(today);
    const grid = ui.el('div', { class: 'diet-grid' });

    // 表头
    grid.appendChild(ui.el('div', { class: 'dg-head', text: '' }));
    for (const d of days) {
      grid.appendChild(ui.el('div', { class: 'dg-head' + (d === today ? ' today' : ''), text: Dates.weekdayCN(d).replace('星期', '周') + ' ' + d.slice(5) }));
    }

    // 三餐输入
    for (let r = 0; r < 3; r++) {
      const key = this.MEAL_KEYS[r];
      grid.appendChild(ui.el('div', { class: 'dg-label', text: this.MEAL_LABELS[r] }));
      for (const d of days) {
        const m = meals[d] || {};
        const ta = ui.el('textarea', { 'data-date': d, 'data-meal': key, placeholder: this.MEAL_LABELS[r] + '餐…' }, [m[key] || '']);
        ta.addEventListener('input', () => this.saveMeal(d, key, ta.value));
        grid.appendChild(ui.el('div', { class: 'dg-cell' }, [ta]));
      }
    }

    // 吃完打勾 + 复制/粘贴
    grid.appendChild(ui.el('div', { class: 'dg-label', text: '' }));
    for (const d of days) {
      const m = meals[d] || {};
      const cell = ui.el('div', { class: 'dg-cell' });
      const doneRow = ui.el('div', { class: 'dg-done' });
      for (let r = 0; r < 3; r++) {
        const k = this.MEAL_KEYS[r];
        const on = !!(m.done && m.done[k]);
        doneRow.appendChild(ui.el('button', {
          'data-date': d, 'data-meal': k,
          class: on ? 'on' : '',
          text: this.MEAL_LABELS[r] + (on ? '✓' : ''),
          title: '标记吃完/取消',
          onclick: () => {
            Store.mutate('diet', (mm) => {
              if (!mm.meals[d]) mm.meals[d] = { breakfast: '', lunch: '', dinner: '', done: {} };
              if (!mm.meals[d].done) mm.meals[d].done = {};
              mm.meals[d].done[k] = !on;
            });
            this.refresh(container);
          },
        }));
      }
      cell.appendChild(doneRow);
      const ops = ui.el('div', { class: 'dg-done', style: 'margin-top:6px' }, [
        ui.el('button', { class: 'dg-copy', 'data-date': d, text: '复制', title: '复制这一天的安排', onclick: () => this.copyDay(d) }),
        ui.el('button', { class: 'dg-paste', 'data-date': d, text: '粘贴', title: '把复制的安排粘到这里', onclick: () => this.pasteDay(d, container) }),
      ]);
      cell.appendChild(ops);
      grid.appendChild(cell);
    }

    return ui.el('div', { class: 'card' }, [
      ui.el('div', { class: 'card-title' }, ['本周安排', ui.el('small', { text: '先「复制」某天，再到目标天「粘贴」' })]),
      grid,
    ]);
  },

  saveMeal(date, key, value) {
    Store.mutate('diet', (m) => {
      if (!m.meals[date]) m.meals[date] = { breakfast: '', lunch: '', dinner: '', done: {} };
      m.meals[date][key] = value;
    });
    if (date === Dates.todayStr() && this._bannerUpdate) this._bannerUpdate();
  },

  copyDay(d) {
    const m = (Store.state.data.diet.meals || {})[d] || {};
    this._copyBuffer = { breakfast: m.breakfast || '', lunch: m.lunch || '', dinner: m.dinner || '' };
    ui.toast('已复制 ' + (d === Dates.todayStr() ? '今天' : d.slice(5)) + ' 的安排');
  },

  pasteDay(d, container) {
    if (!this._copyBuffer) { ui.toast('先点某天的「复制」', 'warn'); return; }
    Store.mutate('diet', (mm) => {
      const cur = mm.meals[d] || { breakfast: '', lunch: '', dinner: '', done: {} };
      mm.meals[d] = {
        breakfast: this._copyBuffer.breakfast,
        lunch: this._copyBuffer.lunch,
        dinner: this._copyBuffer.dinner,
        done: cur.done || {},
      };
    });
    this.refresh(container);
    ui.toast('已粘贴到 ' + (d === Dates.todayStr() ? '今天' : d.slice(5)));
  },
};
