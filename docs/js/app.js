import { api, session, storageIsPersistent } from './api.js';
import { budgetStatus, esc, icon, money, openModal, thisMonth, toast, fmtDay } from './ui.js';
import { openTransactionModal } from './txform.js';
import * as overview from './views/overview.js';
import * as expenses from './views/expenses.js';
import * as incomes from './views/incomes.js';
import * as ledger from './views/ledger.js';
import * as categories from './views/categories.js';
import * as goals from './views/goals.js';
import * as reports from './views/reports.js';
import * as settings from './views/settings.js';

const ROUTES = {
  overview: { label: 'Visão Geral', icon: 'home', view: overview },
  expenses: { label: 'Despesas', icon: 'cart', view: expenses },
  incomes: { label: 'Receitas', icon: 'trend', view: incomes },
  ledger: { label: 'Extrato', icon: 'list', view: ledger },
  categories: { label: 'Categorias', icon: 'tag', view: categories },
  goals: { label: 'Metas', icon: 'target', view: goals },
  reports: { label: 'Relatórios', icon: 'chart', view: reports },
  settings: { label: 'Configurações', icon: 'settings', view: settings },
};
const SEARCHABLE = new Set(['expenses', 'incomes', 'ledger']);

const state = { month: thisMonth(), search: '', reloadShell: () => loadProfile() };
const $ = (id) => document.getElementById(id);

const routeName = () => {
  const name = location.hash.replace('#/', '');
  return ROUTES[name] ? name : 'overview';
};

async function render() {
  const name = routeName();
  $('nav').innerHTML = Object.entries(ROUTES)
    .map(([key, r]) => `<a href="#/${key}" class="${key === name ? 'active' : ''}">${icon(r.icon)}${r.label}</a>`)
    .join('');
  $('month').value = state.month;
  $('search').value = state.search;
  $('search').hidden = !SEARCHABLE.has(name) && !state.search;
  try {
    $('view').innerHTML = await ROUTES[name].view.render(state);
    ROUTES[name].view.bind?.($('view'), state, render);
  } catch (e) {
    if (e.message !== 'Sessão bloqueada') $('view').innerHTML = `<div class="card empty">${esc(e.message)}</div>`;
  }
  refreshBell();
}

async function refreshBell() {
  try {
    const d = await api.dashboard(state.month);
    const n = alertsOf(d).length;
    $('bell').innerHTML = `${icon('bell')}${n ? `<span class="count">${n}</span>` : ''}`;
  } catch { /* bloqueado ou offline */ }
}

function alertsOf(d) {
  const out = [];
  for (const u of d.upcoming) {
    const late = u.date < d.today;
    out.push({ tone: late ? 'red' : 'amber', title: `${u.description}${late ? ' — atrasado' : ''}`, sub: `Vence em ${fmtDay(u.date)}`, value: money(u.amountCents) });
  }
  for (const c of d.categories) {
    const s = budgetStatus(c.spentCents, c.limitCents);
    if (s.pct >= 90) out.push({ tone: 'red', title: `${c.name}: ${s.pct}% do teto`, sub: s.label, value: money(c.spentCents) });
  }
  return out;
}

$('bell').onclick = async () => {
  const items = alertsOf(await api.dashboard(state.month));
  const body = items.length
    ? `<div class="list">${items.map((a) => `
        <div class="list-item ${a.tone === 'red' ? 'overdue' : ''}">
          <span class="icon-tile tone-${a.tone === 'red' ? 'pink' : 'orange'}">${icon('alert')}</span>
          <div class="grow"><div class="title">${esc(a.title)}</div><small>${esc(a.sub)}</small></div>
          <div class="amount">${a.value}</div>
        </div>`).join('')}</div>`
    : '<div class="empty">Tudo em dia! Nenhum alerta neste mês.</div>';
  openModal({ title: 'Alertas', body, submitLabel: 'Fechar', onSubmit: async () => {} });
};

$('new-tx').onclick = () => openTransactionModal({ month: state.month, onDone: render });

const shiftMonth = (delta) => {
  const [y, m] = state.month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  render();
};
$('prev-month').onclick = () => shiftMonth(-1);
$('next-month').onclick = () => shiftMonth(1);
$('month').onchange = (e) => { if (e.target.value) { state.month = e.target.value; render(); } };

let timer;
$('search').oninput = (e) => {
  state.search = e.target.value;
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (state.search && !SEARCHABLE.has(routeName())) location.hash = '#/ledger';
    else render();
  }, 250);
};

async function loadProfile() {
  const { name } = await api.profile();
  $('user-name').textContent = name;
  $('avatar').textContent = name.trim().charAt(0).toUpperCase() || 'F';
  const { hasPin } = await api.authStatus();
  $('lock-btn').hidden = !hasPin;
  $('lock-btn').innerHTML = icon('lock');
}

$('lock-btn').onclick = async () => {
  await api.logout().catch(() => {});
  session.set(null);
  showLock();
};

async function showLock() {
  $('app').hidden = true;
  const { name } = await api.authStatus();
  const root = $('lock-root');
  root.innerHTML = `
    <div class="lock-screen">
      <form class="lock-card">
        <div class="brand"><span class="brand-mark"></span>FinHub</div>
        <h1>Olá, ${esc(name)}</h1>
        <p>Digite seu PIN para acessar as finanças.</p>
        <input type="password" name="pin" inputmode="numeric" autocomplete="off" maxlength="8" aria-label="PIN" required autofocus>
        <div class="error-msg" hidden></div>
        <button class="btn primary block" type="submit">Desbloquear</button>
      </form>
    </div>`;
  const form = root.querySelector('form');
  form.pin.focus();
  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { token } = await api.login(form.pin.value);
      session.set(token);
      root.innerHTML = '';
      start();
    } catch (ex) {
      const err = form.querySelector('.error-msg');
      err.textContent = ex.message;
      err.hidden = false;
      form.pin.value = '';
      form.pin.focus();
    }
  };
}

window.addEventListener('finhub:locked', () => { session.set(null); showLock(); });
window.addEventListener('hashchange', () => { if (!$('app').hidden) render(); });

async function start() {
  $('app').hidden = false;
  await loadProfile();
  render();
  if (!storageIsPersistent) toast('Armazenamento local indisponível: os dados serão perdidos ao fechar a aba.', 'err');
}

(async () => {
  try {
    const status = await api.authStatus();
    if (status.hasPin && !status.unlocked) {
      session.set(null);
      showLock();
    } else {
      start();
    }
  } catch (e) {
    toast(e.message, 'err');
  }
})();
