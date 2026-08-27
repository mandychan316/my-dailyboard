'use strict';
// 自媒体：灵感库 + 内容管理 + 本月统计

const MediaView = {
  state: { tab: 'ideas', platform: 'all', status: 'all' },
  PLATFORMS: ['小红书', '抖音', '视频号', '公众号', '快手'],
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
    container.appendChild(this.stats(container));
    container.appendChild(this.tabs(container));
    if (this.state.tab === 'ideas') container.appendChild(this.ideasView(container));
    else container.appendChild(this.postsView(container));
  },

  statusColor(key) {
    const s = this.STATUSES.find((x) => x.key === key);
    return s ? s.color : 'st-idea';
  },

  stats(container) {
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

    const goPosts = (status) => {
      this.state.tab = 'posts';
      this.state.status = status;
      this.refresh(container);
    };
    const row = ui.el('div', { class: 'stat-row' }, [
      this.statCard('本月已发布', publishedMonth.length, 'primary', () => goPosts('published')),
      this.statCard('待发布', ready, 'accent', () => goPosts('ready')),
      this.statCard('撰写中', writing, '', () => goPosts('writing')),
      this.statCard('灵感', ideaCount, '', () => { this.state.tab = 'ideas'; this.refresh(container); }),
    ]);
    const summary = ui.el('div', { class: 'card', style: 'padding:10px 16px;margin-bottom:16px;font-size:12.5px;color:var(--ink-soft)' }, [
      ui.el('span', { text: '本月发布分布：' + platformText }),
    ]);
    const wrap = ui.el('div');
    wrap.appendChild(row);
    wrap.appendChild(summary);
    return wrap;
  },

  statCard(label, num, cls, onClick) {
    const card = ui.el('div', { class: 'stat-card' + (onClick ? ' clickable' : ''), title: onClick ? '点击查看' : '' }, [
      ui.el('div', { class: 'stat-num ' + (cls || ''), text: String(num) }),
      ui.el('div', { class: 'stat-label', text: label }),
    ]);
    if (onClick) card.addEventListener('click', onClick);
    return card;
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

    const statusFilter = ui.el('select', { id: 'post-status-filter' }, [ui.el('option', { value: 'all', text: '全部状态' })].concat(
      this.STATUSES.map((st) => ui.el('option', { value: st.key, text: st.label }))
    ));
    statusFilter.value = this.state.status;
    statusFilter.addEventListener('change', () => { this.state.status = statusFilter.value; this.refresh(container); });

    wrap.appendChild(ui.el('div', { class: 'filter-bar' }, [
      filter,
      statusFilter,
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
    if (this.state.status !== 'all') posts = posts.filter((p) => p.status === this.state.status);
    posts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return posts;
  },

  postCard(data, post, container) {
    const status = this.STATUSES.find((s) => s.key === post.status) || this.STATUSES[0];
    // 第一层：平台 / 状态 / 发布日期
    const meta = [ui.el('span', { class: 'chip', text: post.platform })];
    meta.push(ui.el('span', { class: 'status ' + status.color, text: status.label }));
    if (post.publishDate) meta.push(ui.el('span', { class: 'chip plain', text: '发布于 ' + post.publishDate }));
    const first = ui.el('div', { class: 'ic-top' }, [
      ui.el('div', { class: 'ic-meta' }, meta),
      ui.el('div', { class: 'ic-actions' }, [
        status.next ? ui.el('button', { class: 'btn btn-sm', text: '推进 → ' + this.STATUS_LABEL[status.next], onclick: () => this.advance(data, post, container) }) : null,
        status.key !== 'idea' ? ui.el('button', { class: 'btn btn-ghost btn-sm', title: '回退一步', html: ui.icon('back'), onclick: () => this.regress(data, post, container) }) : null,
        ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('edit'), title: '编辑', onclick: () => this.postForm(container, post) }),
        ui.el('button', { class: 'btn btn-ghost btn-sm', html: ui.icon('trash'), title: '删除', onclick: () => this.deletePost(data, post, container) }),
      ]),
    ]);
    // 第二层：标题/内容，有链接时可点击直接跳转
    const second = post.link
      ? ui.el('a', { class: 'ic-title ic-link', href: post.link, target: '_blank', rel: 'noopener', title: '点击打开链接', text: post.title })
      : ui.el('div', { class: 'ic-title', text: post.title });
    // 第三层：备注
    const third = post.note ? ui.el('div', { class: 'ic-note', text: post.note }) : null;
    return ui.el('div', { class: 'item-card' }, [first, second, third]);
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
      ui.formRow('标题 / 内容', title),
      ui.formRow('平台', platform),
      ui.formRow('状态', status),
      ui.formRow('链接', link),
      ui.formRow('发布日期', publishDate),
      ui.formRow('备注', note),
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
