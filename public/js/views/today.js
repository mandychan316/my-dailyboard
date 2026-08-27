'use strict';
// 今日计划：按日期管理当天待办

const TodayView = {
  state: { date: Dates.todayStr() },

  render(main) {
    this.state.date = Dates.todayStr();
    const page = ui.el('div', { class: 'page' });
    const container = ui.el('div');
    page.appendChild(container);
    main.appendChild(page);
    this.refresh(container);
  },

  refresh(container) {
    const data = Store.state.data;
    const date = this.state.date;
    const isToday = date === Dates.todayStr();
    this._container = container;
    container.innerHTML = '';

    container.appendChild(ui.el('div', { class: 'page-head' }, [
      ui.el('h1', { class: 'page-title', text: '今日计划' }),
      ui.el('div', { class: 'page-sub', text: isToday ? '今天要做的事，做完一件是一件' : '回看这一天的安排' }),
    ]));

    const card = ui.el('div', { class: 'card' });
    card.appendChild(this.dateNav(container));
    card.appendChild(this.progress(data, date));
    card.appendChild(this.addForm(data, date, container));
    card.appendChild(this.taskList(data, date, container));
    container.appendChild(card);
  },

  dateNav(container) {
    const nav = ui.el('div', { class: 'date-nav' });
    const btn = (iconName, fn) => ui.el('button', { class: 'btn btn-ghost', html: ui.icon(iconName), onclick: fn });
    const label = ui.el('span', { class: 'date-label', text: Dates.formatCN(this.state.date) });
    nav.appendChild(btn('back', () => { this.state.date = Dates.addDays(this.state.date, -1); this.refresh(container); }));
    nav.appendChild(label);
    nav.appendChild(btn('next', () => { this.state.date = Dates.addDays(this.state.date, 1); this.refresh(container); }));
    if (this.state.date !== Dates.todayStr()) {
      nav.appendChild(ui.el('button', { class: 'btn btn-sm', text: '回到今天', onclick: () => { this.state.date = Dates.todayStr(); this.refresh(container); } }));
    }
    nav.appendChild(ui.el('button', {
      class: 'btn btn-ghost btn-sm', title: '打开日历', style: 'margin-left:auto',
      html: ui.icon('calendar'), onclick: () => this.openCalendar(),
    }));
    return nav;
  },

  openCalendar() {
    const data = Store.state.data;
    const tasksByDate = (data.today && data.today.tasksByDate) || {};
    const marks = {};
    for (const d of Object.keys(tasksByDate)) {
      if (tasksByDate[d] && tasksByDate[d].length) marks[d] = true;
    }
    Calendar.open({
      title: '今日计划日历',
      marks,
      tooltip: (dateStr) => {
        const list = tasksByDate[dateStr] || [];
        if (!list.length) return null;
        const lines = list.map((t) => (t.done ? '✓ ' : '· ') + (t.text || ''));
        return Dates.formatCN(dateStr) + '\n' + lines.join('\n');
      },
      onPick: (dateStr) => {
        this.state.date = dateStr;
        this.refresh(this._container);
      },
    });
  },

  tasks(data, date) {
    return (data.today.tasksByDate || {})[date] || [];
  },

  progress(data, date) {
    const tasks = this.tasks(data, date);
    const done = tasks.filter((t) => t.done).length;
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    return ui.el('div', { class: 'progress-line' }, [
      ui.el('div', { class: 'progress-bar' }, [ui.el('div', { class: 'progress-fill', style: 'width:' + pct + '%' })]),
      ui.el('div', { class: 'progress-text', text: tasks.length ? '完成 ' + done + '/' + tasks.length : '还没有安排' }),
    ]);
  },

  addForm(data, date, container) {
    const text = ui.el('input', { type: 'text', id: 'task-text', placeholder: '想做什么？' });
    const priority = ui.el('select', { id: 'task-priority' }, [
      ui.el('option', { value: 'high', text: '高优先级' }),
      ui.el('option', { value: 'mid', text: '中优先级', selected: '' }),
      ui.el('option', { value: 'low', text: '低优先级' }),
    ]);
    const note = ui.el('input', { type: 'text', id: 'task-note', placeholder: '备注（可选）' });
    const add = () => {
      const t = text.value.trim();
      if (!t) { ui.toast('先写点内容再添加吧', 'warn'); return; }
      const item = {
        id: Store.genId(),
        text: t,
        priority: priority.value,
        note: note.value.trim(),
        done: false,
        createdAt: new Date().toISOString(),
      };
      Store.mutate('today', (m) => {
        if (!m.tasksByDate[date]) m.tasksByDate[date] = [];
        m.tasksByDate[date].push(item);
      });
      text.value = ''; note.value = '';
      priority.value = 'mid';
      text.focus();
      this.refresh(container);
    };
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    const btn = ui.el('button', { class: 'btn btn-primary', text: '添加', onclick: add });
    return ui.el('div', { class: 'add-task' }, [text, priority, note, btn]);
  },

  taskList(data, date, container) {
    const tasks = this.tasks(data, date);
    if (!tasks.length) {
      return ui.el('div', { class: 'empty', text: '今天还没有计划，加一件想做的事吧' });
    }
    const list = ui.el('div', { class: 'task-list' });
    for (const task of tasks) {
      list.appendChild(this.taskItem(data, date, task, container));
    }
    return list;
  },

  taskItem(data, date, task, container) {
    const meta = [];
    if (task.priority) {
      const priText = { high: '高', mid: '中', low: '低' }[task.priority] || '中';
      meta.push(ui.el('span', { class: 'meta pri-' + (task.priority || 'mid'), text: '优先级 · ' + priText }));
    }
    const main = ui.el('div', { class: 'task-main' }, [
      ui.el('div', { class: 'task-text', text: task.text }),
      meta.length ? ui.el('div', { class: 'task-meta' }, meta) : null,
      task.note ? ui.el('div', { class: 'task-note', text: task.note }) : null,
    ]);
    const item = ui.el('div', { class: 'task-item' + (task.done ? ' done' : '') }, [
      ui.el('button', {
        class: 'task-check', html: ui.icon('check'),
        title: task.done ? '标记为未完成' : '标记为完成',
        onclick: () => {
          Store.mutate('today', (m) => { const t = m.tasksByDate[date].find((x) => x.id === task.id); if (t) t.done = !t.done; });
          this.refresh(container);
        },
      }),
      main,
      ui.el('div', { class: 'task-actions' }, [
        ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('edit'), title: '编辑', onclick: () => this.editTask(data, date, task, container) }),
        ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('trash'), title: '删除', onclick: () => this.deleteTask(data, date, task, container) }),
      ]),
    ]);
    return item;
  },

  async deleteTask(data, date, task, container) {
    const ok = await ui.confirmDialog('删除事项', '确定删除「' + task.text + '」吗？');
    if (!ok) return;
    Store.mutate('today', (m) => {
      m.tasksByDate[date] = m.tasksByDate[date].filter((x) => x.id !== task.id);
      if (!m.tasksByDate[date].length) delete m.tasksByDate[date];
    });
    this.refresh(container);
  },

  editTask(data, date, task, container) {
    const text = ui.el('input', { type: 'text', value: task.text });
    const priority = ui.el('select', {}, [
      ui.el('option', { value: 'high', text: '高优先级' }),
      ui.el('option', { value: 'mid', text: '中优先级' }),
      ui.el('option', { value: 'low', text: '低优先级' }),
    ]);
    priority.value = task.priority || 'mid';
    const note = ui.el('textarea', { rows: 2 }, [task.note || '']);
    const root = document.getElementById('modal-root');
    const overlay = ui.el('div', { class: 'modal-overlay' });
    const box = ui.el('div', { class: 'modal form-modal' }, [
      ui.el('div', { class: 'modal-title', text: '编辑事项' }),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '内容' }), text]),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '优先级' }), priority]),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '备注（可选）' }), note]),
      ui.el('div', { class: 'modal-actions' }, [
        ui.el('button', { class: 'btn', text: '取消', onclick: () => overlay.remove() }),
        ui.el('button', {
          class: 'btn btn-primary', text: '保存',
          onclick: () => {
            const t = text.value.trim();
            if (!t) { ui.toast('内容不能为空', 'warn'); return; }
            Store.mutate('today', (m) => {
              const x = m.tasksByDate[date].find((y) => y.id === task.id);
              if (x) { x.text = t; x.priority = priority.value; x.note = note.value.trim(); }
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
};
