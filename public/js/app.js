'use strict';
// 应用入口：路由 + 启动

(function () {
  const NAV_ICONS = { home: 'home', today: 'today', ai: 'ai', media: 'media', exercise: 'exercise', diet: 'diet', settings: 'settings' };
  for (const [view, ic] of Object.entries(NAV_ICONS)) {
    const node = document.getElementById('nav-ico-' + view);
    if (node) node.innerHTML = ui.icon(ic);
  }

  const views = {
    home: HomeView,
    today: TodayView,
    ai: AIView,
    media: MediaView,
    exercise: ExerciseView,
    diet: DietView,
    settings: SettingsView,
  };

  async function init() {
    try {
      await Store.loadAll();
    } catch (e) {
      console.error(e);
      document.getElementById('main').innerHTML = '<div class="page"><div class="card"><div class="empty">无法连接本地数据服务，请重新双击启动器。</div></div></div>';
      return;
    }
    window.addEventListener('hashchange', route);
    route();
  }

  function route() {
    const name = (location.hash || '#/home').replace('#/', '').split('?')[0] || 'home';
    const view = views[name] || views.home;
    const main = document.getElementById('main');
    main.innerHTML = '';
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === name));
    view.render(main);
    main.scrollTop = 0;
  }

  window.addEventListener('beforeunload', () => { Store.flushAll(); });
  init();
})();
