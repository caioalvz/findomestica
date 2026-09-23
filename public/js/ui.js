const ICONS = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 001 .6H18a1 1 0 001-.8L21 7H6"/>',
  heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM7 13h.01M17 13h.01"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  gift: '<path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8S10 3 8 4.5 9 8 12 8zm0 0s2-5 4-3.5S15 8 12 8z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
};
export const ICON_KEYS = Object.keys(ICONS);
export const COLOR_KEYS = ['indigo', 'green', 'pink', 'blue', 'purple', 'orange'];

export const icon = (key) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[key] ?? ICONS.star}</svg>`;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (cents) => brl.format(cents / 100).replace(/ /g, ' ');
export const toCents = (text) => {
  const n = Number(String(text).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
export const fromCents = (cents) => (cents / 100).toFixed(2).replace('.', ',');
export const fmtDate = (iso) => iso.split('-').reverse().join('/');

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

export const progressBar = (pct, tone) =>
  `<div class="progress ${tone}"><i style="width:${Math.min(pct, 100)}%"></i></div>`;

export function openModal({ title, body, submitLabel = 'Salvar', onSubmit }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop">
      <form class="modal">
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
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = form.querySelector('.error-msg');
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
      close();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  };
  form.querySelector('input, select')?.focus();
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
export const eyebrow = (ym) => `Planejamento doméstico • <b>Ciclo ${monthLabel(ym)}</b>`;
