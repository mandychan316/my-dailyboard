'use strict';
// 首页总览：日期 + 快捷备忘 + 今日路线

const HomeView = {
  render(main) {
    const data = Store.state.data;
    const today = Dates.todayStr();
    const page = ui.el('div', { class: 'page home' });
    page.appendChild(this.hero(today));
    page.appendChild(this.memoCard(data));
    page.appendChild(this.routeCard(data, today));
    main.appendChild(page);
  },

  hero(today) {
    return ui.el('div', { class: 'home-hero' }, [
      ui.el('div', {}, [
        ui.el('div', { class: 'date-big', text: Dates.formatCN(today) }),
        ui.el('div', { class: 'greet', text: Dates.greetingCN() + '，用户' }),
      ]),
    ]);
  },

  memoCard(data) {
    const list = ui.el('div', { class: 'memo-list' });
    const refresh = () => this.renderMemoList(data, list);
    refresh();
    const input = ui.el('input', { type: 'text', id: 'memo-input', placeholder: '记一句备忘，回车保存…' });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        const text = input.value.trim();
        Store.mutate('notes', (m) => m.notes.push({ id: Store.genId(), text, createdAt: new Date().toISOString() }));
        input.value = '';
        refresh();
      }
    });
    return ui.el('div', { class: 'card' }, [
      ui.el('div', { class: 'card-title' }, ['快捷备忘', ui.el('small', { text: '随手记，随时看' })]),
      ui.el('div', { class: 'memo-input' }, [input]),
      list,
    ]);
  },

  renderMemoList(data, list) {
    list.innerHTML = '';
    const notes = (data.notes.notes || []).slice().reverse().slice(0, 8);
    if (!notes.length) {
      list.appendChild(ui.el('div', { class: 'empty', text: '还没有备忘，想到什么随手记一句吧' }));
      return;
    }
    for (const n of notes) {
      const item = ui.el('div', { class: 'memo-item' }, [
        ui.el('span', { class: 'memo-time', text: (n.createdAt || '').slice(5, 16).replace('T', ' ') }),
        ui.el('span', { class: 'memo-text', text: n.text }),
        ui.el('button', {
          class: 'btn btn-ghost btn-sm',
          html: ui.icon('trash'),
          onclick: () => this.deleteMemo(n.id, data, list),
        }),
      ]);
      list.appendChild(item);
    }
  },

  async deleteMemo(id, data, list) {
    const ok = await ui.confirmDialog('删除备忘', '确定删除这条备忘吗？');
    if (!ok) return;
    Store.mutate('notes', (m) => { m.notes = m.notes.filter((n) => n.id !== id); });
    this.renderMemoList(data, list);
  },

  routeCard(data, today) {
    const stations = this.stations(data, today);
    const route = ui.el('div', { class: 'route' });
    for (const s of stations) {
      const st = ui.el('div', { class: 'station' + (s.lit ? ' lit' : ''), onclick: () => { location.hash = s.hash; } }, [
        ui.el('div', { class: 'dot' }),
        ui.el('div', { class: 'st-ico', html: ui.icon(s.icon) }),
        ui.el('div', { class: 'st-body' }, [
          ui.el('div', { class: 'st-name', text: s.name }),
          ui.el('div', { class: 'st-summary', text: s.summary }),
        ]),
        ui.el('div', { class: 'st-go', html: ui.icon('chevron') }),
      ]);
      route.appendChild(st);
    }
    return ui.el('div', { class: 'card' }, [
      ui.el('div', { class: 'card-title' }, ['今日路线', ui.el('small', { text: '过完一天是一天' })]),
      route,
    ]);
  },

  stations(data, today) {
    const tasks = (data.today.tasksByDate || {})[today] || [];
    const done = tasks.filter((t) => t.done).length;

    const meals = (data.diet.meals || {})[today] || {};
    const mealNames = ['breakfast', 'lunch', 'dinner'];
    const mealLabels = { breakfast: '早', lunch: '午', dinner: '晚' };
    const mealParts = mealNames
      .map((k) => {
        const has = !!(meals[k] && String(meals[k]).trim());
        const d = !!(meals.done && meals.done[k]);
        return mealLabels[k] + (d ? '✓' : has ? '·' : '—');
      })
      .join('  ');

    const checkin = (data.exercise.checkins || {})[today];
    const plan = (data.exercise.weekPlan || {})[String(Dates.weekdayIndex(today))];
    const aiToday = (data.ai.logs || []).filter((l) => l.date === today).length;
    const readyPosts = (data.media.posts || []).filter((p) => p.status === 'ready').length;

    let exerciseSummary;
    if (checkin && checkin.done) {
      exerciseSummary = '已完成今日打卡' + (checkin.extra ? ' · ' + checkin.extra : '');
    } else if (plan && plan.content) {
      exerciseSummary = '今晚：' + plan.content + (plan.minutes ? '，' + plan.minutes + ' 分钟' : '');
    } else {
      exerciseSummary = '今天没有安排，也可以拉伸一下';
    }

    return [
      {
        name: '今日计划', icon: 'today', hash: '#/today',
        summary: tasks.length ? '完成 ' + done + '/' + tasks.length : '今天还没有计划，加一件想做的事吧',
        lit: done > 0,
      },
      {
        name: '三餐', icon: 'diet', hash: '#/diet',
        summary: mealParts,
        lit: mealNames.some((k) => meals[k] && String(meals[k]).trim()),
      },
      { name: '运动', icon: 'exercise', hash: '#/exercise', summary: exerciseSummary, lit: !!(checkin && checkin.done) },
      {
        name: 'AI实践', icon: 'ai', hash: '#/ai',
        summary: aiToday ? '今天记录了 ' + aiToday + ' 条' : '今天还没记录，用 AI 做了什么都值得记一笔',
        lit: aiToday > 0,
      },
      {
        name: '自媒体', icon: 'media', hash: '#/media',
        summary: readyPosts ? '待发布 ' + readyPosts + ' 条' : '暂无待发布内容',
        lit: readyPosts > 0,
      },
    ];
  },
};
