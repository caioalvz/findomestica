import * as overview from './views/overview.js';
import * as expenses from './views/expenses.js';
import * as incomes from './views/incomes.js';
import * as categories from './views/categories.js';
import * as reports from './views/reports.js';

const ROUTES = {
  overview: { label: 'Visão Geral', view: overview },
  expenses: { label: 'Despesas', view: expenses },
  incomes: { label: 'Receitas', view: incomes },
  categories: { label: 'Categorias', view: categories },
  reports: { label: 'Relatórios', view: reports },
};

const state = { month: new Date().toISOString().slice(0, 7), search: '' };
const $ = (id) => document.getElementById(id);

const routeName = () => {
  const name = location.hash.replace('#/', '');
  return ROUTES[name] ? name : 'overview';
};

async function render() {
  const name = routeName();
  $('nav').innerHTML = Object.entries(ROUTES)
    .map(([key, r]) => `<a href="#/${key}" class="${key === name ? 'active' : ''}">${r.label}</a>`)
    .join('');
  $('month').value = state.month;
  $('search').value = state.search;
  try {
    $('view').innerHTML = await ROUTES[name].view.render(state);
    ROUTES[name].view.bind?.($('view'), state, render);
  } catch (e) {
    $('view').innerHTML = `<div class="card empty">${e.message}</div>`;
  }
}

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
  timer = setTimeout(render, 250);
};
window.addEventListener('hashchange', render);
render();
