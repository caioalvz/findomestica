const ICONS = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 001 .6H18a1 1 0 001-.8L21 7H6"/>',
  heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM7 13h.01M17 13h.01"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  gift: '<path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8S10 3 8 4.5 9 8 12 8zm0 0s2-5 4-3.5S15 8 12 8z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  wallet: '<path d="M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2zM16 14.5h.01"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8zM7.5 8.5h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  bell: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 118 0v4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3L2 20h20zM12 10v4M12 17.5h.01"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 16V5M7 9l5-5 5 5M4 20h16"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a2 2 0 012-2h14a2 2 0 012 2v6a1 1 0 01-1 1h-2M6 14h12v7H6z"/>',
};
export const CATEGORY_ICONS = ['home', 'cart', 'heart', 'car', 'book', 'bolt', 'gift', 'star', 'wallet', 'trend', 'target'];
export const COLOR_KEYS = ['indigo', 'green', 'pink', 'blue', 'purple', 'orange'];
export const COLOR_LABELS = { indigo: 'Índigo', green: 'Verde', pink: 'Rosa', blue: 'Azul', purple: 'Roxo', orange: 'Laranja' };

export const icon = (key) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key] ?? ICONS.star}</svg>`;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (cents) => brl.format(cents / 100).replace(/ /g, ' ');
export const signed = (cents) => `${cents >= 0 ? '+' : '−'} ${money(Math.abs(cents))}`;
export const toCents = (text) => {
  const n = Number(String(text).trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
export const fromCents = (cents) => (cents / 100).toFixed(2).replace('.', ',');
export const fmtDate = (iso) => iso.split('-').reverse().join('/');
export const fmtDay = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const thisMonth = () => localDate().slice(0, 7);

export function budgetStatus(spent, limit) {
  if (!limit) return { pct: 0, label: 'Sem teto', tone: '' };
  const pct = Math.round((spent / limit) * 100);
  if (pct > 100) return { pct, label: 'Estourado', tone: 'red' };
  if (pct >= 90) return { pct, label: 'Alerta', tone: 'red' };
  if (pct >= 70) return { pct, label: 'Atenção', tone: 'amber' };
  return { pct, label: 'Seguro', tone: 'green' };
}

export const pageHead = ({ eyebrow, title, sub, actions = '' }) => `
  <div class="page-head">
    <div>
      <div class="eyebrow">${eyebrow}</div>
      <h1 class="page-title">${esc(title)}</h1>
      <p class="page-sub">${esc(sub)}</p>
    </div>
    <div class="actions">${actions}</div>
  </div>`;

export const metricCard = ({ label, value, valueTone = '', tile, tileTone, foot }) => `
  <div class="card metric">
    <div class="metric-top"><span>${esc(label)}</span><span class="icon-tile tone-${tileTone}">${icon(tile)}</span></div>
    <div class="metric-value ${valueTone}">${value}</div>
    <div class="metric-foot">${foot}</div>
  </div>`;

export const progressBar = (pct, tone = '') =>
  `<div class="progress ${tone}"><i style="width:${Math.max(0, Math.min(pct, 100))}%"></i></div>`;

export const tabs = (items, active) => `
  <div class="tabs" role="tablist">
    ${items.map(([key, label]) => `<button type="button" role="tab" class="tab ${key === active ? 'active' : ''}" data-tab="${key}">${esc(label)}</button>`).join('')}
  </div>`;

export function delta(cur, prev, { invert = false } = {}) {
  if (!prev) return '<span class="badge">sem base anterior</span>';
  const pct = Math.round(((cur - prev) / prev) * 100);
  const good = invert ? pct <= 0 : pct >= 0;
  return `<span class="badge ${good ? 'green' : 'red'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%</span> vs. mês anterior`;
}

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const monthShort = (ym) => MONTH_SHORT[Number(ym.slice(5)) - 1];
export const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
export const eyebrow = (ym) => `Planejamento doméstico • <b>Ciclo ${monthLabel(ym)}</b>`;

export function groupedBars(series) {
  const max = Math.max(1, ...series.flatMap((s) => [s.incomeCents, s.expenseCents]));
  const cols = series.map((s) => `
    <div class="gcol">
      <div class="gbars">
        <i class="gbar inc" style="height:${(s.incomeCents / max) * 100}%" title="${monthLabel(s.month)} — Receitas: ${money(s.incomeCents)}"></i>
        <i class="gbar exp" style="height:${(s.expenseCents / max) * 100}%" title="${monthLabel(s.month)} — Despesas: ${money(s.expenseCents)}"></i>
      </div>
      <span>${monthShort(s.month)}</span>
    </div>`).join('');
  return `<div class="gchart">${cols}</div>
    <div class="legend"><span><i class="dot inc"></i>Receitas</span><span><i class="dot exp"></i>Despesas</span></div>`;
}

export function toast(message, tone = 'ok') {
  const el = Object.assign(document.createElement('div'), { className: `toast ${tone}`, textContent: message });
  document.getElementById('toast-root').append(el);
  setTimeout(() => el.remove(), 3200);
}

function closeOnEscape(close) {
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

export function openModal({ title, body, submitLabel = 'Salvar', onSubmit, wide = false }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop">
      <form class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2>${esc(title)}</h2>
        ${body}
        <div class="error-msg" hidden></div>
        <div class="modal-actions">
          <button type="button" class="btn" data-cancel>Cancelar</button>
          <button type="submit" class="btn primary">${esc(submitLabel)}</button>
        </div>
      </form>
    </div>`;
  const close = () => { root.innerHTML = ''; };
  const form = root.querySelector('form');
  form.querySelector('[data-cancel]').onclick = close;
  root.querySelector('.modal-backdrop').onmousedown = (e) => { if (e.target === e.currentTarget) close(); };
  closeOnEscape(close);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = form.querySelector('.error-msg');
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)), form);
      close();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      submit.disabled = false;
    }
  };
  form.querySelector('input, select, textarea')?.focus();
  return form;
}

export function confirmBox(message, { confirmLabel = 'Excluir', tone = 'danger' } = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal small" role="alertdialog" aria-modal="true">
          <p class="confirm-text">${esc(message)}</p>
          <div class="modal-actions">
            <button type="button" class="btn" data-no>Cancelar</button>
            <button type="button" class="btn ${tone === 'danger' ? 'danger-fill' : 'primary'}" data-yes>${esc(confirmLabel)}</button>
          </div>
        </div>
      </div>`;
    const done = (v) => { root.innerHTML = ''; resolve(v); };
    root.querySelector('[data-no]').onclick = () => done(false);
    root.querySelector('[data-yes]').onclick = () => done(true);
    root.querySelector('.modal-backdrop').onmousedown = (e) => { if (e.target === e.currentTarget) done(false); };
    root.querySelector('[data-yes]').focus();
  });
}
