'use strict';
// 通用 UI：DOM 构建、提示、确认框、图标

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
  }
  if (children) {
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
  }
  return node;
}

const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M10 20v-5.5h4V20"/>',
  today: '<path d="M4 5.5h16v14H4z"/><path d="M8 3.5v4M16 3.5v4M4 9.5h16"/><path d="m8.5 14 2.2 2.2 4.8-4.9"/>',
  ai: '<path d="M12 3l1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9z"/><path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  media: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  exercise: '<path d="M12 5.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z"/><path d="M7.5 8.5h9v3.5l3 2-1.2 1.8-3.3-2.2v6.9h-2.4v-6l-1.5.9v5.1H9v-6.2l-3 2.2L4.8 14l3-2z"/>',
  diet: '<path d="M4 11h16a8 8 0 0 1-8 8 8 8 0 0 1-8-8z"/><path d="M9 5.5c-1.5 1-2.5 3-2.5 5.5M15 5.5c1.5 1 2.5 3 2.5 5.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3.5v4M16 3.5v4M3.5 9.5h17"/><path d="M7.5 13h2M7.5 16h2M11.5 13h2M11.5 16h2M15.5 13h2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.3 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.3 2.6h4l.3-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2z"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m13.5 6.5 3 3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
};

function icon(name, cls) {
  const d = ICONS[name] || '';
  return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
}

function toast(msg, type) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const t = el('div', { class: 'toast ' + (type || 'ok'), text: msg });
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 1600);
}

function confirmDialog(title, message, opts) {
  const o = Object.assign({ confirmText: '删除', cancelText: '取消', danger: true }, opts || {});
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const overlay = el('div', { class: 'modal-overlay' });
    const box = el('div', { class: 'modal' }, [
      el('div', { class: 'modal-title', text: title }),
      el('div', { class: 'modal-msg', text: message }),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn', text: o.cancelText, onclick: () => { close(false); } }),
        el('button', {
          class: 'btn ' + (o.danger ? 'btn-danger' : 'btn-primary'),
          text: o.confirmText,
          onclick: () => { close(true); },
        }),
      ]),
    ]);
    function close(result) {
      overlay.remove();
      resolve(result);
    }
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    root.appendChild(overlay);
  });
}

const ui = { escapeHtml, el, icon, toast, confirmDialog };

if (typeof window !== 'undefined') window.ui = ui;
