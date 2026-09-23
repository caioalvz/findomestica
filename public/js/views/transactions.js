import { api } from '../api.js';
import { esc, eyebrow, fmtDate, fromCents, metricCard, money, openModal, pageHead, toCents } from '../ui.js';

export function transactionsView({ kind, title, sub, newLabel, totalLabel, tile, tileTone }) {
  const sign = kind === 'expense' ? 'neg' : 'pos';

  async function render({ month, search }) {
    const rows = await api.transactions({ month, kind, q: search });
    const total = rows.reduce((a, r) => a + r.amountCents, 0);
    const body = rows.map((r) => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${esc(r.description)}</td>
        <td>${r.categoryName ? `<span class="badge tone-${r.categoryColor}">${esc(r.categoryName)}</span>` : '<span class="badge">Sem categoria</span>'}</td>
        <td class="num ${sign}">${kind === 'expense' ? '−' : '+'} ${money(r.amountCents)}</td>
        <td class="num">
          <button class="btn small" data-edit="${r.id}">Editar</button>
          <button class="btn small danger" data-del="${r.id}">Excluir</button>
        </td>
      </tr>`).join('');

    return `
      ${pageHead({ eyebrow: eyebrow(month), title, sub, actions: `<button class="btn primary" data-new>+ ${newLabel}</button>` })}
      <div class="grid cols-3">
        ${metricCard({ label: totalLabel, value: money(total), tile, tileTone, foot: `${rows.length} lançamentos` })}
      </div>
      <div class="section-head"><h2>Lançamentos</h2></div>
      <div class="card">
        <table class="table">
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th><th></th></tr></thead>
          <tbody>${body || '<tr><td colspan="5" class="empty">Nenhum lançamento neste mês.</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  async function form(t = {}, month) {
    const cats = (await api.categories(month)).filter((c) => c.type === kind);
    const opts = cats.map((c) => `<option value="${c.id}" ${c.id === t.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    return `
      <div class="field"><label>Descrição</label><input name="description" required maxlength="120" value="${esc(t.description)}"></div>
      <div class="field"><label>Valor (R$)</label><input name="amount" inputmode="decimal" required value="${t.amountCents ? fromCents(t.amountCents) : ''}"></div>
      <div class="field"><label>Data</label><input type="date" name="date" required value="${t.date ?? `${month}-01`}"></div>
      <div class="field"><label>Categoria</label><select name="categoryId"><option value="">Sem categoria</option>${opts}</select></div>`;
  }

  function bind(root, { month }, refresh) {
    const save = (id) => async (f) => {
      const amountCents = toCents(f.amount);
      if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('Valor inválido');
      await api.saveTransaction({
        id, kind, description: f.description, amountCents, date: f.date,
        categoryId: f.categoryId ? Number(f.categoryId) : null,
      });
      refresh();
    };
    root.querySelector('[data-new]').onclick = async () =>
      openModal({ title: newLabel, body: await form({}, month), onSubmit: save() });
    root.querySelectorAll('[data-edit]').forEach((b) => {
      b.onclick = async () => {
        const t = (await api.transactions({ month, kind })).find((x) => x.id === Number(b.dataset.edit));
        openModal({ title: 'Editar lançamento', body: await form(t, month), onSubmit: save(t.id) });
      };
    });
    root.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        if (confirm('Excluir lançamento?')) { await api.deleteTransaction(b.dataset.del); refresh(); }
      };
    });
  }

  return { render, bind };
}
