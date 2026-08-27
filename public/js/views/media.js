'use strict';
// 自媒体：灵感库 + 内容管理 + 本月统计

const MediaView = {
  state: { tab: 'ideas', platform: 'all' },
  PLATFORMS: ['小红书', '抖音', '视频号', '公众号'],
  STATUSES: [
    { key: 'idea', label: '灵感', next: 'writing', color: 'st-idea' },
    { key: 'writing', label: '撰写', next: 'ready', color: 'st-writing' },
    { key: 'ready', label: '待发布', next: 'published', color: 'st-ready' },
    { key: 'published', label: '已发布', next: null, color: 'st-published' },
  ],
  STATUS_LABEL: { idea: '灵感', writing: '撰写', ready: '待发布', published: '已发布' },

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
      ui.el('h1', { class: 'page-title', text: '自媒体' }),
      ui.el('div', { class: 'page-sub', text: '小红书是主阵地，灵感别丢，进度看得见' }),
    ]));
    container.appendChild(this.stats());
    container.appendChild(this.tabs(container));
    if (this.state.tab === 'ideas') container.appendChild(this.ideasView(container));
    else container.appendChild(this.postsView(container));
  },

  statusColor(key) {
    const s = this.STATUSES.find((x) => x.key === key);
    return s ? s.color : 'st-idea';
  },

  stats() {
    const data = Store.state.data.media;
    const posts = data.posts || [];
    const ideas = data.ideas || [];
    const month = Dates.monthOf(Dates.todayStr());
    const publishedMonth = posts.filter((p) => p.status === 'published' && p.publishDate && Dates.monthOf(p.publishDate) === month);
    const writing = posts.filter((p) => p.status === 'writing').length;
    const ready = posts.filter((p) => p.status === 'ready').length;
    const ideaCount = ideas.filter((i) => i.status !== 'converted').length;

    const byPlatform = {};
    for (const p of publishedMonth) byPlatform[p.platform] = (byPlatform[p.platform] || 0) + 1;
    const platformText = Object.keys(byPlatform).length
      ? Object.entries(byPlatform).map(([k, v]) => k + ' ' + v).join('　')
      : '本月还没有发布记录';

    const row = ui.el('div', { class: 'stat-row' }, [
      this.statCard('本月已发布', publishedMonth.length, 'primary'),
      this.statCard('待发布', ready, 'accent'),
      this.statCard('撰写中', writing, ''),
      this.statCard('灵感', ideaCount, ''),
    ]);
    const summary = ui.el('div', { class: 'card', style: 'padding:10px 16px;margin-bottom:16px;font-size:12.5px;color:var(--ink-soft)' }, [
      ui.el('span', { text: '本月发布分布：' + platformText }),
    ]);
    const wrap = ui.el('div');
    wrap.appendChild(row);
    wrap.appendChild(summary);
    return wrap;
  },

  statCard(label, num, cls) {
    return ui.el('div', { class: 'stat-card' }, [
      ui.el('div', { class: 'stat-num ' + (cls || ''), text: String(num) }),
      ui.el('div', { class: 'stat-label', text: label }),
    ]);
  },

  tabs(container) {
    const tabs = ui.el('div', { class: 'tabs' });
    const make = (key, label) =>
      ui.el('button', { class: 'tab' + (this.state.tab === key ? ' active' : ''), text: label, onclick: () => { this.state.tab = key; this.refresh(container); } });
    tabs.appendChild(make('ideas', '灵感库'));
    tabs.appendChild(make('posts', '内容管理'));
    return tabs;
  },

  /* ---------- 灵感库 ---------- */

  ideasView(container) {
    const data = Store.state.data.media;
    const ideas = (data.ideas || []).slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const wrap = ui.el('div');

    const input = ui.el('input', { type: 'text', id: 'idea-text', placeholder: '一闪而过的想法，先记下来…' });
    const platform = ui.el('select', { id: 'idea-platform' }, this.PLATFORMS.map((p, i) => ui.el('option', { value: p, text: p, selected: i === 0 ? '' : null })));
    const add = () => {
      const t = input.value.trim();
      if (!t) { ui.toast('写点内容再添加吧', 'warn'); return; }
      Store.mutate('media', (m) => m.ideas.push({ id: Store.genId(), text: t, platform: platform.value, status: 'idea', createdAt: new Date().toISOString() }));
      input.value = '';
      this.refresh(container);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    const bar = ui.el('div', { class: 'add-task' }, [input, platform, ui.el('button', { class: 'btn btn-primary', text: '记下来', onclick: add })]);
    wrap.appendChild(bar);

    const list = ui.el('div', { style: 'margin-top:14px' });
    if (!ideas.length) {
      list.appendChild(ui.el('div', { class: 'empty', text: '灵感库还空着，把想到的选题先存下来' }));
    } else {
      for (const idea of ideas) list.appendChild(this.ideaCard(data, idea, container));
    }
    wrap.appendChild(list);
    return wrap;
  },

  ideaCard(data, idea, container) {
    const converted = idea.status === 'converted';
    const card = ui.el('div', { class: 'item-card' }, [
      ui.el('div', { class: 'ic-top' }, [
        ui.el('div', { style: 'flex:1;min-width:0' }, [
          ui.el('span', { class: 'chip', text: idea.platform }),
          converted ? ui.el('span', { class: 'chip done', text: '已转内容' }) : ui.el('span', { class: 'chip plain', text: '灵感' }),
          ui.el('div', { class: 'ic-body', style: 'margin-top:6px', text: idea.text }),
        ]),
        ui.el('div', { class: 'ic-actions' }, [
          converted ? null : ui.el('button', { class: 'btn btn-sm', text: '转为内容', onclick: () => this.convertIdea(data, idea, container) }),
          ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('trash'), title: '删除', onclick: () => this.deleteIdea(data, idea, container) }),
        ]),
      ]),
    ]);
    return card;
  },

  convertIdea(data, idea, container) {
    Store.mutate('media', (m) => {
      const x = m.ideas.find((y) => y.id === idea.id);
      if (x) x.status = 'converted';
      m.posts.push({
        id: Store.genId(),
        platform: idea.platform,
        title: idea.text,
        status: 'writing',
        link: '',
        publishDate: '',
        note: '',
        fromIdea: idea.id,
        createdAt: new Date().toISOString(),
      });
    });
    ui.toast('已转为内容，去「内容管理」继续');
    this.refresh(container);
  },

  async deleteIdea(data, idea, container) {
    const ok = await ui.confirmDialog('删除灵感', '确定删除这条灵感吗？');
    if (!ok) return;
    Store.mutate('media', (m) => { m.ideas = m.ideas.filter((x) => x.id !== idea.id); });
    this.refresh(container);
  },

  /* ---------- 内容管理 ---------- */

  postsView(container) {
    const data = Store.state.data.media;
    const posts = this.filteredPosts(data);
    const wrap = ui.el('div');

    const filter = ui.el('select', {}, [ui.el('option', { value: 'all', text: '全部平台' })].concat(
      this.PLATFORMS.map((p) => ui.el('option', { value: p, text: p }))
    ));
    filter.value = this.state.platform;
    filter.addEventListener('change', () => { this.state.platform = filter.value; this.refresh(container); });

    wrap.appendChild(ui.el('div', { class: 'filter-bar' }, [
      filter,
      ui.el('div', { style: 'flex:1' }),
      ui.el('button', { class: 'btn btn-primary', html: ui.icon('plus') + '新增内容', onclick: () => this.postForm(container, null) }),
    ]));

    const list = ui.el('div');
    if (!posts.length) {
      list.appendChild(ui.el('div', { class: 'empty', text: '还没有内容，从灵感开始或直接新建一条吧' }));
    } else {
      for (const post of posts) list.appendChild(this.postCard(data, post, container));
    }
    wrap.appendChild(list);
    return wrap;
  },

  filteredPosts(data) {
    let posts = (data.posts || []).slice();
    if (this.state.platform !== 'all') posts = posts.filter((p) => p.platform === this.state.platform);
    posts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return posts;
  },

  postCard(data, post, container) {
    const status = this.STATUSES.find((s) => s.key === post.status) || this.STATUSES[0];
    const card = ui.el('div', { class: 'item-card' }, [
      ui.el('div', { class: 'ic-top' }, [
        ui.el('div', { style: 'flex:1;min-width:0' }, [
          ui.el('span', { class: 'chip', text: post.platform }),
          ui.el('span', { class: 'status ' + status.color, text: status.label, style: 'margin-left:8px' }),
          ui.el('div', { class: 'ic-title', style: 'margin-top:6px', text: post.title }),
        ]),
        ui.el('div', { class: 'ic-actions' }, [
          status.next ? ui.el('button', { class: 'btn btn-sm', text: '推进 → ' + this.STATUS_LABEL[status.next], onclick: () => this.advance(data, post, container) }) : null,
          status.key !== 'idea' ? ui.el('button', { class: 'btn btn-ghost btn-sm', title: '回退一步', html: ui.icon('back'), onclick: () => this.regress(data, post, container) }) : null,
          ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('edit'), title: '编辑', onclick: () => this.postForm(container, post) }),
          ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('trash'), title: '删除', onclick: () => this.deletePost(data, post, container) }),
        ]),
      ]),
      (post.link || post.publishDate || post.note) ? ui.el('div', { class: 'ic-foot' }, [
        post.link ? ui.el('a', { class: 'chip plain', href: post.link, target: '_blank', rel: 'noopener', text: '链接' }) : null,
        post.publishDate ? ui.el('span', { class: 'chip plain', text: '发布于 ' + post.publishDate }) : null,
        post.note ? ui.el('span', { class: 'chip plain', text: post.note }) : null,
      ]) : null,
    ]);
    return card;
  },

  advance(data, post, container) {
    const s = this.STATUSES.find((x) => x.key === post.status);
    if (!s || !s.next) return;
    Store.mutate('media', (m) => {
      const x = m.posts.find((y) => y.id === post.id);
      if (x) {
        x.status = s.next;
        if (s.next === 'published' && !x.publishDate) x.publishDate = Dates.todayStr();
      }
    });
    this.refresh(container);
  },

  regress(data, post, container) {
    const order = ['idea', 'writing', 'ready', 'published'];
    const idx = order.indexOf(post.status);
    if (idx <= 0) return;
    const prev = order[idx - 1];
    Store.mutate('media', (m) => {
      const x = m.posts.find((y) => y.id === post.id);
      if (x) x.status = prev;
    });
    this.refresh(container);
  },

  postForm(container, post) {
    const platform = ui.el('select', {}, this.PLATFORMS.map((p) => ui.el('option', { value: p, text: p })));
    platform.value = post ? (post.platform || this.PLATFORMS[0]) : this.PLATFORMS[0];
    const title = ui.el('input', { type: 'text', value: post ? (post.title || '') : '', placeholder: '标题 / 一句话内容' });
    const status = ui.el('select', {}, this.STATUSES.map((s) => ui.el('option', { value: s.key, text: s.label })));
    status.value = post ? (post.status || 'idea') : 'idea';
    const link = ui.el('input', { type: 'text', value: post ? (post.link || '') : '', placeholder: '发布链接（可选）' });
    const publishDate = ui.el('input', { type: 'date', value: post ? (post.publishDate || '') : '' });
    const note = ui.el('input', { type: 'text', value: post ? (post.note || '') : '', placeholder: '备注（可选）' });

    const root = document.getElementById('modal-root');
    const overlay = ui.el('div', { class: 'modal-overlay' });
    const box = ui.el('div', { class: 'modal form-modal' }, [
      ui.el('div', { class: 'modal-title', text: post ? '编辑内容' : '新增内容' }),
      ui.el('div', { class: 'field-row' }, [
        ui.el('label', { class: 'field' }, [ui.el('span', { text: '平台' }), platform]),
        ui.el('label', { class: 'field' }, [ui.el('span', { text: '状态' }), status]),
      ]),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '标题 / 内容' }), title]),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '链接' }), link]),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '发布日期' }), publishDate]),
      ui.el('label', { class: 'field' }, [ui.el('span', { text: '备注' }), note]),
      ui.el('div', { class: 'modal-actions' }, [
        ui.el('button', { class: 'btn', text: '取消', onclick: () => overlay.remove() }),
        ui.el('button', {
          class: 'btn btn-primary', text: '保存',
          onclick: () => {
            if (!title.value.trim()) { ui.toast('标题不能为空', 'warn'); return; }
            Store.mutate('media', (m) => {
              if (post) {
                const x = m.posts.find((y) => y.id === post.id);
                if (x) { x.platform = platform.value; x.title = title.value.trim(); x.status = status.value; x.link = link.value.trim(); x.publishDate = publishDate.value; x.note = note.value.trim(); }
              } else {
                m.posts.push({ id: Store.genId(), platform: platform.value, title: title.value.trim(), status: status.value, link: link.value.trim(), publishDate: publishDate.value, note: note.value.trim(), createdAt: new Date().toISOString() });
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

  async deletePost(data, post, container) {
    const ok = await ui.confirmDialog('删除内容', '确定删除「' + post.title + '」吗？');
    if (!ok) return;
    Store.mutate('media', (m) => { m.posts = m.posts.filter((x) => x.id !== post.id); });
    this.refresh(container);
  },
};
