import { api } from '../api.js';
import {
  COLOR_KEYS, ICON_KEYS, budgetStatus, esc, eyebrow, fromCents, icon, metricCard, money,
  openModal, pageHead, progressBar, toCents,
} from '../ui.js';

export async function render({ month }) {
  const { categories, limitCents, spentCents } = await api.summary(month);
  const balance = limitCents - spentCents;
  const usedPct = limitCents ? Math.round((spentCents / limitCents) * 100) : 0;

  const cards = categories.map((c) => {
    const s = budgetStatus(c.spentCents, c.limitCents);
    return `
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
      </div>`;
  }).join('');

  return `
    ${pageHead({
      eyebrow: eyebrow(month),
      title: 'Categorias & Orçamentos',
      sub: 'Defina os tetos de gastos para cada categoria doméstica e acompanhe o consumo do mês.',
      actions: '<button class="btn primary" data-new>+ Nova Categoria</button>',
    })}
    <div class="grid cols-3">
      ${metricCard({ label: 'Orçamento Total Definido', value: money(limitCents), tile: 'cart', tileTone: 'indigo', foot: `<span class="badge indigo">${categories.length} tetos</span> distribuídos no mês` })}
      ${metricCard({ label: 'Total Consumido', value: money(spentCents), tile: 'star', tileTone: 'green', foot: `<span class="badge ${usedPct >= 90 ? 'red' : 'green'}">${usedPct}%</span> do teto global consumido` })}
      ${metricCard({ label: 'Saldo Disponível', value: money(balance), valueTone: balance >= 0 ? 'green' : 'red', tile: 'heart', tileTone: 'green', foot: `<span class="badge green">${Math.max(100 - usedPct, 0)}% restante</span>` })}
    </div>
    <div class="section-head"><h2>Tetos por Categoria</h2><span class="badge">${categories.length} ativas</span></div>
    <div class="grid cols-3">${cards || '<div class="card empty">Nenhuma categoria ainda.</div>'}</div>`;
}

const options = (list, selected) => list.map((k) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${k}</option>`).join('');

function form(c = {}) {
  return `
    <div class="field"><label>Nome</label><input name="name" required maxlength="80" value="${esc(c.name)}"></div>
    <div class="field"><label>Descrição</label><input name="subtitle" maxlength="60" value="${esc(c.subtitle)}"></div>
    <div class="field"><label>Teto mensal (R$)</label><input name="limit" inputmode="decimal" required value="${fromCents(c.limitCents ?? 0)}"></div>
    <div class="field"><label>Ícone</label><select name="icon">${options(ICON_KEYS, c.icon)}</select></div>
    <div class="field"><label>Cor</label><select name="color">${options(COLOR_KEYS, c.color)}</select></div>`;
}

export function bind(root, { month }, refresh) {
  const load = () => api.categories(month);
  const save = (id) => async (f) => {
    const limitCents = toCents(f.limit);
    if (Number.isNaN(limitCents)) throw new Error('Teto inválido');
    await api.saveCategory({ id, name: f.name, subtitle: f.subtitle, icon: f.icon, color: f.color, type: 'expense', limitCents });
    refresh();
  };
  root.querySelector('[data-new]').onclick = () =>
    openModal({ title: 'Nova Categoria', body: form(), onSubmit: save() });
  root.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = async () => {
      const c = (await load()).find((x) => x.id === Number(b.dataset.edit));
      openModal({ title: 'Definir Orçamento', body: form(c), onSubmit: save(c.id) });
    };
  });
  root.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (confirm('Excluir categoria? As transações ficarão sem categoria.')) {
        await api.deleteCategory(b.dataset.del);
        refresh();
      }
    };
  });
}
