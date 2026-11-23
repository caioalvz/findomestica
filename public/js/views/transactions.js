import { api } from '../api.js';
import { openTransactionModal } from '../txform.js';
import {
  confirmBox, esc, eyebrow, fmtDate, icon, metricCard, money, pageHead, tabs, toast,
} from '../ui.js';

const PAGE_SIZE = 10;

/**
 * Cria uma tela de lançamentos. kind: 'expense' | 'income' | 'all'.
 */
export function transactionsView({ kind, title, sub, newLabel, labels, tile, tileTone }) {
  const filters = { status: 'all', page: 1, key: '' };
  let rows = [];

  async function render({ month, search }) {
    const key = `${month}|${search}`;
    if (key !== filters.key) { filters.key = key; filters.page = 1; }
    rows = await api.transactions({ month, kind: kind === 'all' ? '' : kind, q: search });

    const sum = (list) => list.reduce((a, r) => a + r.amountCents, 0);
    const done = rows.filter((r) => r.status === 'paid');
    const pending = rows.filter((r) => r.status === 'pending');
    const shown = filters.status === 'all' ? rows : rows.filter((r) => r.status === filters.status);
    const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
    filters.page = Math.min(filters.page, pages);
    const slice = shown.slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE);

    const cards = kind === 'all'
      ? [
        metricCard({ label: 'Receitas', value: money(sum(rows.filter((r) => r.kind === 'income'))), tile: 'trend', tileTone: 'green', foot: `${rows.filter((r) => r.kind === 'income').length} lançamentos` }),
        metricCard({ label: 'Despesas', value: money(sum(rows.filter((r) => r.kind === 'expense'))), tile: 'cart', tileTone: 'pink', foot: `${rows.filter((r) => r.kind === 'expense').length} lançamentos` }),
        metricCard({
          label: 'Saldo do período', value: money(sum(rows.filter((r) => r.kind === 'income')) - sum(rows.filter((r) => r.kind === 'expense'))),
          tile: 'wallet', tileTone: 'indigo', foot: 'receitas − despesas',
        }),
      ]
      : [
        metricCard({ label: labels.total, value: money(sum(rows)), tile, tileTone, foot: `${rows.length} lançamentos` }),
        metricCard({ label: labels.done, value: money(sum(done)), valueTone: 'green', tile: 'check', tileTone: 'green', foot: `${done.length} ${labels.doneFoot}` }),
        metricCard({ label: labels.pending, value: money(sum(pending)), valueTone: pending.length ? 'red' : '', tile: 'alert', tileTone: 'orange', foot: `${pending.length} ${labels.pendingFoot}` }),
      ];

    const body = slice.map((r) => {
      const isExp = r.kind === 'expense';
      return `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${esc(r.description)}</td>
        <td>${r.categoryName ? `<span class="badge tone-${r.categoryColor}">${esc(r.categoryName)}</span>` : '<span class="badge">Sem categoria</span>'}</td>
        <td><span class="badge ${r.status === 'paid' ? 'green' : 'amber'}">${r.status === 'paid' ? (isExp ? 'Pago' : 'Recebido') : 'Pendente'}</span></td>
        <td class="num ${isExp ? 'neg' : 'pos'}">${isExp ? '−' : '+'} ${money(r.amountCents)}</td>
        <td class="row-actions">
          ${r.status === 'pending' ? `<button class="btn small success" data-pay="${r.id}">${isExp ? 'Marcar pago' : 'Marcar recebido'}</button>` : ''}
          <button class="btn small" data-edit="${r.id}">Editar</button>
          <button class="btn small danger" data-del="${r.id}">Excluir</button>
        </td>
      </tr>`;
    }).join('');

    const first = shown.length ? (filters.page - 1) * PAGE_SIZE + 1 : 0;
    return `
      ${pageHead({
        eyebrow: eyebrow(month), title, sub,
        actions: kind === 'all'
          ? `<button class="btn" data-export>${icon('download')}Exportar CSV</button>`
          : `<button class="btn" data-export>${icon('download')}Exportar CSV</button><button class="btn primary" data-new>+ ${newLabel}</button>`,
      })}
      <div class="grid cols-3">${cards.join('')}</div>
      <div class="section-head"><h2>Lançamentos</h2>
        ${tabs([['all', 'Todos'], ['pending', 'Pendentes'], ['paid', 'Concluídos']], filters.status)}
      </div>
      <div class="card">
        <table class="table">
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Situação</th><th class="num">Valor</th><th></th></tr></thead>
          <tbody>${body || '<tr><td colspan="6" class="empty">Nenhum lançamento encontrado.</td></tr>'}</tbody>
        </table>
        <div class="pager">
          <span>Exibindo ${first}–${first ? first + slice.length - 1 : 0} de ${shown.length}</span>
          <div class="btns">
            <button class="btn small" data-page="-1" ${filters.page <= 1 ? 'disabled' : ''}>Anterior</button>
            <button class="btn small" data-page="1" ${filters.page >= pages ? 'disabled' : ''}>Próxima</button>
          </div>
        </div>
      </div>`;
  }

  function bind(root, { month }, refresh) {
    const find = (id) => rows.find((x) => x.id === Number(id));
    root.querySelector('[data-new]')?.addEventListener('click', () =>
      openTransactionModal({ kind: kind === 'all' ? undefined : kind, month, onDone: refresh }));
    root.querySelector('[data-export]').onclick = () => api.downloadCsv(month).catch((e) => toast(e.message, 'err'));
    root.querySelectorAll('[data-tab]').forEach((b) => {
      b.onclick = () => { filters.status = b.dataset.tab; filters.page = 1; refresh(); };
    });
    root.querySelectorAll('[data-page]').forEach((b) => {
      b.onclick = () => { filters.page += Number(b.dataset.page); refresh(); };
    });
    root.querySelectorAll('[data-pay]').forEach((b) => {
      b.onclick = async () => { await api.toggleTransaction(b.dataset.pay); toast('Lançamento atualizado'); refresh(); };
    });
    root.querySelectorAll('[data-edit]').forEach((b) => {
      b.onclick = () => openTransactionModal({ tx: find(b.dataset.edit), month, onDone: refresh });
    });
    root.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        if (await confirmBox('Excluir este lançamento? Essa ação não pode ser desfeita.')) {
          await api.deleteTransaction(b.dataset.del);
          toast('Lançamento excluído');
          refresh();
        }
      };
    });
  }

  return { render, bind };
}
