'use strict';
// 日期工具（纯函数，Node 测试也可直接引用）

const DAY_MS = 86400000;
const WEEKDAYS_CN = ['日', '一', '二', '三', '四', '五', '六'];

function pad(n) { return String(n).padStart(2, '0'); }

// 本地日期 -> YYYY-MM-DD
function toDateStr(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

// 今天（本地时区）YYYY-MM-DD
function todayStr() {
  return toDateStr(new Date());
}

// YYYY-MM-DD -> 本地当天 0 点的 Date
function parseDate(str) {
  const parts = String(str).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

// 加 n 天
function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

// 例如: 2026-08-25 -> "8月25日 · 星期二"
function formatCN(str) {
  const d = parseDate(str);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + WEEKDAYS_CN[d.getDay()];
}

function weekdayCN(str) {
  return '星期' + WEEKDAYS_CN[parseDate(str).getDay()];
}

// 所在周的周一 YYYY-MM-DD（周一为一周开始）
function weekStart(str) {
  const d = parseDate(str);
  const day = d.getDay(); // 0=周日
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

// 返回所在周 7 天（周一到周日）
function weekDays(str) {
  const start = parseDate(weekStart(str));
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(toDateStr(d));
  }
  return out;
}

// YYYY-MM-DD -> 周几序号 1=周一 ... 7=周日
function weekdayIndex(str) {
  const day = parseDate(str).getDay();
  return day === 0 ? 7 : day;
}

// YYYY-MM-DD -> "2026-08"
function monthOf(str) {
  return String(str).slice(0, 7);
}

// 今日问候语
function greetingCN() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

const Dates = {
  DAY_MS, WEEKDAYS_CN, pad, toDateStr, todayStr, parseDate, addDays,
  formatCN, weekdayCN, weekStart, weekDays, weekdayIndex, monthOf, greetingCN,
};

if (typeof module !== 'undefined' && module.exports) module.exports = Dates;
if (typeof window !== 'undefined') window.Dates = Dates;
