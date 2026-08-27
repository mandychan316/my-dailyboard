'use strict';
// 通用日历弹窗：标记日期高亮、悬浮查看内容、点击选择日期
// 用法: Calendar.open({ title, marks: {date:true}, tooltip(date)->html|null, onPick(date) })

const Calendar = {
  open(opts) {
    this.opts = opts;
    this.viewDate = Dates.todayStr();
    const root = document.getElementById('modal-root');
    const overlay = ui.el('div', { class: 'modal-overlay' });
    const box = ui.el('div', { class: 'modal form-modal cal-modal' });
    const close = () => overlay.remove();
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    root.appendChild(overlay);
    this.render(box, close);
  },

  render(box, close) {
    const y = Number(this.viewDate.slice(0, 4));
    const m = Number(this.viewDate.slice(5, 7));
    const todayStr = Dates.todayStr();
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const dow = (first.getDay() + 6) % 7; // 0 = 周一

    const title = ui.el('div', { class: 'modal-title', text: this.opts.title || '日历' });
    const prev = ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('back'), title: '上个月', onclick: () => { this.viewDate = Dates.toDateStr(new Date(y, m - 2, 1)); this.render(box, close); } });
    const next = ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('next'), title: '下个月', onclick: () => { this.viewDate = Dates.toDateStr(new Date(y, m, 1)); this.render(box, close); } });
    const label = ui.el('span', { class: 'cal-month', text: y + '年' + m + '月' });
    const todayBtn = this.viewDate.slice(0, 7) !== todayStr.slice(0, 7)
      ? ui.el('button', { class: 'btn btn-sm', text: '回到本月', onclick: () => { this.viewDate = todayStr; this.render(box, close); } })
      : null;
    const head = ui.el('div', { class: 'cal-head' }, [prev, label, next, todayBtn]);
    const grid = ui.el('div', { class: 'cal-grid' });
    for (const w of ['一', '二', '三', '四', '五', '六', '日']) {
      grid.appendChild(ui.el('div', { class: 'cal-wd', text: w }));
    }
    for (let i = 0; i < dow; i++) grid.appendChild(ui.el('div', { class: 'cal-cell blank' }));

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = Dates.toDateStr(new Date(y, m - 1, d));
      const has = !!(this.opts.marks && this.opts.marks[dateStr]);
      const tip = this.opts.tooltip ? this.opts.tooltip(dateStr) : null;
      const cell = ui.el('div', {
        class: 'cal-cell' + (has ? ' has' : '') + (dateStr === todayStr ? ' today' : ''),
        'data-date': dateStr,
        text: String(d),
        title: '',
      });
      if (tip) cell.appendChild(ui.el('div', { class: 'cal-tip', html: tip }));
      cell.addEventListener('click', () => {
        if (this.opts.onPick) this.opts.onPick(dateStr);
        close();
      });
      grid.appendChild(cell);
    }

    box.innerHTML = '';
    box.appendChild(title);
    box.appendChild(head);
    box.appendChild(grid);
    box.appendChild(ui.el('div', { class: 'cal-foot' }, [
      ui.el('span', { class: 'cal-legend' }, [ui.el('i', { class: 'dot' }), '有记录的日期']),
      ui.el('span', { class: 'hint', text: '悬浮可预览，点击可跳转' }),
      ui.el('button', { class: 'btn btn-sm', text: '关闭', onclick: close }),
    ]));
  },
};
