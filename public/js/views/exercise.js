'use strict';
// 运动计划：每周计划（瑜伽/拉伸）+ 每日打卡 + 本周统计

const ExerciseView = {
  state: { weekDate: null },
  _statsEls: null,

  render(main) {
    const page = ui.el('div', { class: 'page' });
    const container = ui.el('div');
    page.appendChild(container);
    main.appendChild(page);
    this.refresh(container);
  },

  refresh(container) {
    this._statsEls = null;
    this._container = container;
    if (!this.state.weekDate) this.state.weekDate = Dates.todayStr();
    container.innerHTML = '';
    container.appendChild(ui.el('div', { class: 'page-head' }, [
      ui.el('h1', { class: 'page-title', text: '运动计划' }),
      ui.el('div', { class: 'page-sub', text: '以瑜伽和拉伸为主，先定计划，再一天天打卡' }),
    ]));
    const split = ui.el('div', { class: 'split' });
    split.appendChild(this.planCard());
    split.appendChild(this.checkinCard());
    container.appendChild(split);
  },

  stats() {
    const data = Store.state.data.exercise;
    const weekDate = this.state.weekDate || Dates.todayStr();
    const days = Dates.weekDays(weekDate);
    const checkins = data.checkins || {};
    const weekPlan = data.weekPlan || {};
    const doneCount = days.filter((d) => checkins[d] && checkins[d].done).length;
    const planCount = Object.values(weekPlan).filter((p) => p && p.content).length;
    return { doneCount, planCount, days };
  },

  // 只更新统计数字，不重建页面（避免输入框失焦/丢焦点）
  refreshStats() {
    const { doneCount, planCount } = this.stats();
    const pct = planCount ? Math.round((doneCount / planCount) * 100) : 0;
    if (this._statsEls) {
      this._statsEls.fill.style.width = pct + '%';
      this._statsEls.text.textContent = '本周 ' + doneCount + '/' + planCount + ' 天';
    }
  },

  /* ---------- 每周计划 ---------- */

  planCard() {
    const data = Store.state.data.exercise;
    const weekPlan = data.weekPlan || {};
    const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const card = ui.el('div', { class: 'card' }, [
      ui.el('div', { class: 'card-title' }, ['每周计划', ui.el('small', { text: '改动自动保存' })]),
    ]);
    for (let i = 1; i <= 7; i++) {
      const p = weekPlan[i] || {};
      const content = ui.el('input', { type: 'text', placeholder: '休息 / 练什么', value: p.content || '' });
      const minutes = ui.el('input', { type: 'number', min: '0', step: '5', placeholder: '分钟', value: p.minutes || '' });
      const save = () => this.savePlan(i, content.value, minutes.value);
      content.addEventListener('input', save);
      minutes.addEventListener('input', save);
      content.addEventListener('change', () => this.refreshStats());
      minutes.addEventListener('change', () => this.refreshStats());
      card.appendChild(ui.el('div', { class: 'week-row' }, [
        ui.el('span', { class: 'wday', text: names[i - 1] }),
        content,
        minutes,
        ui.el('span', { class: 'hint', text: '分钟' }),
      ]));
    }
    return card;
  },

  savePlan(i, content, minutes) {
    Store.mutate('exercise', (m) => {
      const text = content.trim();
      const mins = Number(minutes);
      if (text || (minutes !== '' && minutes !== null && !isNaN(mins))) {
        m.weekPlan[i] = { content: text, minutes: minutes !== '' ? mins : 0 };
      } else {
        delete m.weekPlan[i];
      }
    });
  },

  openCalendar() {
    const data = Store.state.data.exercise;
    const checkins = data.checkins || {};
    const weekPlan = data.weekPlan || {};
    const marks = {};
    for (const d of Object.keys(checkins)) {
      const c = checkins[d];
      if (c && (c.done || c.extra || c.content || c.minutes)) marks[d] = true;
    }
    Calendar.open({
      title: '运动打卡日历',
      marks,
      tooltip: (dateStr) => {
        const c = checkins[dateStr] || {};
        const plan = weekPlan[String(Dates.weekdayIndex(dateStr))] || {};
        const lines = [Dates.formatCN(dateStr)];
        if (c.done) lines.push('✓ 已打卡');
        const content = c.content || plan.content || '';
        const minutes = c.minutes != null ? c.minutes : plan.minutes || '';
        if (content) lines.push('运动：' + content + (minutes ? '，' + minutes + ' 分钟' : ''));
        if (c.extra) lines.push('额外：' + c.extra);
        if (!c.done && !content && !c.extra) lines.push('这一天没有运动记录');
        return lines.join('\n');
      },
      onPick: (dateStr) => {
        this.state.weekDate = dateStr;
        this.refresh(this._container);
      },
    });
  },

  /* ---------- 本周打卡 ---------- */

  checkinCard() {
    const data = Store.state.data.exercise;
    const today = Dates.todayStr();
    const weekDate = this.state.weekDate || today;
    const days = Dates.weekDays(weekDate);
    const checkins = data.checkins || {};
    const { doneCount, planCount } = this.stats();

    const titleRight = ui.el('div', { style: 'display:flex;align-items:center;gap:8px' }, [
      weekDate !== today ? ui.el('button', { class: 'btn btn-sm', text: '回到本周', onclick: () => { this.state.weekDate = today; this.refresh(this._container); } }) : null,
      ui.el('button', { class: 'btn btn-ghost btn-sm', title: '打开日历', html: ui.icon('calendar'), onclick: () => this.openCalendar() }),
    ]);
    const card = ui.el('div', { class: 'card' }, [
      ui.el('div', { class: 'card-title' }, [
        '本周打卡',
        ui.el('small', { text: weekDate === today ? ('从 ' + Dates.weekStart(today) + ' 开始的一周') : ('正在查看 ' + Dates.weekStart(weekDate) + ' 开始的一周') }),
        titleRight,
      ]),
    ]);

    for (const d of days) {
      const c = checkins[d] || {};
      const isToday = d === today;
      const row = ui.el('div', { class: 'checkin-row' + (isToday ? ' today' : '') }, [
        ui.el('div', { class: 'ci-date' }, [
          d.slice(5),
          ui.el('span', { class: 'w', text: Dates.weekdayCN(d) }),
          isToday ? ui.el('span', { class: 'chip done', text: '今天', style: 'margin-left:6px' }) : null,
        ]),
        ui.el('button', {
          class: 'btn ' + (c.done ? 'btn-primary' : 'btn-ghost'),
          text: c.done ? '已打卡' : '打卡',
          onclick: () => {
            Store.mutate('exercise', (m) => {
              const cur = m.checkins[d] || { done: false, extra: '' };
              m.checkins[d] = { done: !cur.done, extra: cur.extra || '' };
            });
            this.refresh(this._container);
          },
        }),
        ui.el('div', { class: 'ci-extra' }, [
          ui.el('input', {
            type: 'text',
            placeholder: '额外练了什么（可选）',
            value: c.extra || '',
            onchange: (e) => {
              Store.mutate('exercise', (m) => {
                if (!m.checkins[d]) m.checkins[d] = { done: false };
                m.checkins[d].extra = e.target.value.trim();
              });
            },
          }),
        ]),
      ]);
      card.appendChild(row);
    }

    const pct = planCount ? Math.round((doneCount / planCount) * 100) : 0;
    const fill = ui.el('div', { class: 'progress-fill', style: 'width:' + pct + '%' });
    const text = ui.el('div', { class: 'progress-text', text: '本周 ' + doneCount + '/' + planCount + ' 天' });
    this._statsEls = { fill, text };
    card.appendChild(ui.el('div', { class: 'progress-line', style: 'margin-top:14px;margin-bottom:0' }, [
      ui.el('div', { class: 'progress-bar' }, [fill]),
      text,
    ]));
    return card;
  },
};
