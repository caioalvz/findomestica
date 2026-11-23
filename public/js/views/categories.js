import { api } from '../api.js';
import {
  CATEGORY_ICONS, COLOR_KEYS, COLOR_LABELS, budgetStatus, confirmBox, esc, eyebrow, fromCents, icon, metricCard,
  money, openModal, pageHead, progressBar, tabs, toCents, toast,
} from '../ui.js';

let tab = 'all';
let list = [];

export async function render({ month }) {
  list = await api.categories(month);
  const expense = list.filter((c) => c.type === 'expense');
  const income = list.filter((c) => c.type === 'income');
  const limitCents = expense.reduce((a, c) => a + c.limitCents, 0);
  const spentCents = expense.reduce((a, c) => a + c.spentCents, 0);
  const balance = limitCents - spentCents;
  const usedPct = limitCents ? Math.round((spentCents / limitCents) * 100) : 0;

  const withStatus = expense.map((c) => ({ c, s: budgetStatus(c.spentCents, c.limitCents) }));
  const alerts = withStatus.filter(({ s }) => s.tone === 'red' || s.tone === 'amber');
  const safe = withStatus.filter(({ s }) => !(s.tone === 'red' || s.tone === 'amber'));
  const visible = tab === 'alert' ? alerts : tab === 'safe' ? safe : withStatus;

  const cards = visible.map(({ c, s }) => `
    <div class="card">
      <div class="cat-card-head">
        <span class="icon-tile tone-${c.color}">${icon(c.icon)}</span>
        <div class="grow"><div class="cat-name">${esc(c.name)}</div><div class="cat-sub">${esc(c.subtitle)}</div></div>
        <span class="badge ${s.tone}">${s.pct}% • ${s.label}</span>
      </div>
      <div class="cat-stats">
        <div><small>Gasto atual</small><strong>${money(c.spentCents)}</strong></div>
        <div style="text-align:right"><small>Teto mensal</small><strong>${money(c.limitCents)}</strong></div>
      </div>
      ${progressBar(s.pct, s.tone)}
      <div class="cat-foot"><span>Restam ${money(Math.max(c.limitCents - c.spentCents, 0))}</span><span>Teto ${s.pct}%</span></div>
      <div class="card-actions">
        <button class="btn small" data-edit="${c.id}">Editar</button>
        <button class="btn small danger" data-del="${c.id}">Excluir</button>
      </div>
    </div>`).join('');

  const incomeCards = income.map((c) => `
    <div class="card">
      <div class="cat-card-head" style="margin:0">
        <span class="icon-tile tone-${c.color}">${icon(c.icon)}</span>
        <div class="grow"><div class="cat-name">${esc(c.name)}</div><div class="cat-sub">${esc(c.subtitle)}</div></div>
        <button class="btn small" data-edit="${c.id}">Editar</button>
        <button class="btn small danger" data-del="${c.id}">Excluir</button>
      </div>
    </div>`).join('');

  return `
    ${pageHead({
      eyebrow: eyebrow(month), title: 'Categorias & Orçamentos',
      sub: 'Defina os tetos de gastos para cada categoria doméstica e acompanhe o consumo do mês.',
      actions: '<button class="btn primary" data-new>+ Nova Categoria</button>',
    })}
    <div class="grid cols-3">
      ${metricCard({ label: 'Orçamento Total Definido', value: money(limitCents), tile: 'wallet', tileTone: 'indigo', foot: `<span class="badge indigo">${expense.length} tetos</span> distribuídos no mês` })}
      ${metricCard({ label: 'Total Consumido', value: money(spentCents), tile: 'cart', tileTone: 'pink', foot: `<span class="badge ${usedPct >= 90 ? 'red' : 'green'}">${usedPct}%</span> do teto global consumido` })}
      ${metricCard({ label: 'Saldo Disponível', value: money(balance), valueTone: balance >= 0 ? 'green' : 'red', tile: 'heart', tileTone: 'green', foot: `<span class="badge green">${Math.max(100 - usedPct, 0)}% restante</span>` })}
    </div>
    <div class="section-head"><h2>Tetos por Categoria</h2>
      ${tabs([['all', `Todos (${withStatus.length})`], ['alert', `Em alerta (${alerts.length})`], ['safe', `Seguros (${safe.length})`]], tab)}
    </div>
    <div class="grid cols-3">${cards || '<div class="card empty">Nenhuma categoria neste filtro.</div>'}</div>
    <div class="section-head"><h2>Categorias de Receita</h2><span class="badge">${income.length}</span></div>
    <div class="grid cols-3">${incomeCards || '<div class="card empty">Nenhuma categoria de receita.</div>'}</div>`;
}

const options = (keys, selected, labels = {}) =>
  keys.map((k) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${labels[k] ?? k}</option>`).join('');

function form(c = {}) {
  return `
    <div class="field"><label>Nome</label><input name="name" required maxlength="80" value="${esc(c.name)}"></div>
    <div class="field"><label>Descrição</label><input name="subtitle" maxlength="60" value="${esc(c.subtitle)}"></div>
    <div class="field-row">
      <div class="field"><label>Tipo</label>
        <select name="type"><option value="expense" ${c.type !== 'income' ? 'selected' : ''}>Despesa</option><option value="income" ${c.type === 'income' ? 'selected' : ''}>Receita</option></select></div>
      <div class="field"><label>Teto mensal (R$)</label><input name="limit" inputmode="decimal" required value="${fromCents(c.limitCents ?? 0)}"><small>Apenas para despesas</small></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Ícone</label><select name="icon">${options(CATEGORY_ICONS, c.icon)}</select></div>
      <div class="field"><label>Cor</label><select name="color">${options(COLOR_KEYS, c.color, COLOR_LABELS)}</select></div>
    </div>`;
}

export function bind(root, { month }, refresh) {
  const save = (id) => async (f) => {
    const limitCents = toCents(f.limit);
    if (!Number.isInteger(limitCents) || limitCents < 0) throw new Error('Teto inválido');
    await api.saveCategory({
      id, name: f.name, subtitle: f.subtitle, icon: f.icon, color: f.color, type: f.type, limitCents: f.type === 'income' ? 0 : limitCents,
    });
    toast('Categoria salva');
    refresh();
  };
  root.querySelector('[data-new]').onclick = () => openModal({ title: 'Nova Categoria', body: form(), onSubmit: save() });
  root.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; refresh(); }; });
  root.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => {
      const c = list.find((x) => x.id === Number(b.dataset.edit));
      openModal({ title: 'Definir Orçamento', body: form(c), onSubmit: save(c.id) });
    };
  });
  root.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (await confirmBox('Excluir categoria? Os lançamentos ficarão sem categoria.')) {
        await api.deleteCategory(b.dataset.del);
        toast('Categoria excluída');
        refresh();
      }
    };
  });
}
