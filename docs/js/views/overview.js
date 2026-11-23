import { api } from '../api.js';
import {
  budgetStatus, delta, esc, eyebrow, fmtDate, fmtDay, groupedBars, icon, metricCard, money, pageHead,
  progressBar, toast,
} from '../ui.js';

export async function render({ month }) {
  const d = await api.dashboard(month);
  const saved = d.incomeCents - d.expenseCents;
  const rate = d.incomeCents ? Math.round((saved / d.incomeCents) * 100) : 0;
  const avg = (key) => Math.round(d.flow.reduce((a, f) => a + f[key], 0) / d.flow.length);
  const flowSaved = d.flow.reduce((a, f) => a + f.incomeCents - f.expenseCents, 0);

  const upcoming = d.upcoming.map((u) => {
    const late = u.date < d.today;
    return `
      <div class="list-item ${late ? 'overdue' : ''}">
        <div class="grow">
          <div class="title">${esc(u.description)}</div>
          <small>${late ? '<b style="color:var(--red)">Atrasado</b> · ' : ''}Vence em ${fmtDay(u.date)}</small>
        </div>
        <div>
          <div class="amount">${money(u.amountCents)}</div>
          <button class="btn small success" data-pay="${u.id}">${icon('check')}Pagar</button>
        </div>
      </div>`;
  }).join('');

  const recent = d.recent.map((r) => `
    <tr>
      <td>${fmtDate(r.date)}</td>
      <td>${esc(r.description)}</td>
      <td>${r.categoryName ? `<span class="badge tone-${r.categoryColor}">${esc(r.categoryName)}</span>` : '<span class="badge">Sem categoria</span>'}</td>
      <td><span class="badge ${r.status === 'paid' ? 'green' : 'amber'}">${r.status === 'paid' ? 'Concluído' : 'Pendente'}</span></td>
      <td class="num ${r.kind === 'expense' ? 'neg' : 'pos'}">${r.kind === 'expense' ? '−' : '+'} ${money(r.amountCents)}</td>
    </tr>`).join('');

  const budgets = [...d.categories].filter((c) => c.limitCents > 0)
    .sort((a, b) => b.spentCents / b.limitCents - a.spentCents / a.limitCents).slice(0, 4).map((c) => {
      const s = budgetStatus(c.spentCents, c.limitCents);
      return `<div class="budget-line">
        <div class="top"><span>${esc(c.name)}</span><span>${money(c.spentCents)} / ${money(c.limitCents)}</span></div>
        ${progressBar(s.pct, s.tone)}</div>`;
    }).join('');

  const goalsTotal = d.goals.reduce((a, g) => a + g.savedCents, 0);
  const goalsTarget = d.goals.reduce((a, g) => a + g.targetCents, 0);
  const goalPct = goalsTarget ? Math.round((goalsTotal / goalsTarget) * 100) : 0;

  return `
    ${pageHead({
      eyebrow: eyebrow(month), title: 'Visão Geral Doméstica',
      sub: 'Gestão integrada do orçamento familiar e fluxo de caixa do mês.',
      actions: `<button class="btn" data-export>${icon('download')}Exportar Relatório</button>`,
    })}
    <div class="grid cols-4">
      ${metricCard({ label: 'Saldo Atual', value: money(d.balanceCents), valueTone: d.balanceCents >= 0 ? '' : 'red', tile: 'wallet', tileTone: 'indigo', foot: 'acumulado de lançamentos concluídos' })}
      ${metricCard({ label: 'Receitas do Mês', value: money(d.incomeCents), valueTone: 'green', tile: 'trend', tileTone: 'green', foot: delta(d.incomeCents, d.prevIncomeCents) })}
      ${metricCard({ label: 'Despesas do Mês', value: money(d.expenseCents), tile: 'cart', tileTone: 'pink', foot: delta(d.expenseCents, d.prevExpenseCents, { invert: true }) })}
      ${metricCard({ label: 'Economia do Mês', value: money(saved), valueTone: saved >= 0 ? 'green' : 'red', tile: 'star', tileTone: 'purple', foot: `<span class="badge ${rate >= 20 ? 'green' : rate >= 0 ? 'amber' : 'red'}">${rate}%</span> da renda poupada` })}
    </div>
    <div class="grid wide-left">
      <div class="card">
        <div class="card-head"><div class="card-title">Fluxo Mensal<small>Receitas versus despesas dos últimos 6 meses</small></div></div>
        ${groupedBars(d.flow)}
        <div class="stat-row">
          <div><small>Média de entradas</small><strong>${money(avg('incomeCents'))}</strong></div>
          <div><small>Média de saídas</small><strong>${money(avg('expenseCents'))}</strong></div>
          <div><small>Economia no período</small><strong style="color:${flowSaved >= 0 ? 'var(--green)' : 'var(--red)'}">${money(flowSaved)}</strong></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title">Vencimentos Próximos</div>${d.pendingCount ? `<span class="badge amber">${d.pendingCount} pendentes</span>` : ''}</div>
        <div class="list">${upcoming || '<div class="empty">Nenhuma conta pendente. 🎉</div>'}</div>
      </div>
    </div>
    <div class="grid wide-left">
      <div class="card">
        <div class="card-head"><div class="card-title">Últimas Movimentações<small>Lançamentos mais recentes do mês</small></div><a href="#/ledger">Ver histórico completo ›</a></div>
        <table class="table">
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Situação</th><th class="num">Valor</th></tr></thead>
          <tbody>${recent || '<tr><td colspan="5" class="empty">Sem lançamentos neste mês.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="grid" style="grid-template-columns:1fr;margin-top:0">
        <div class="card">
          <div class="card-head"><div class="card-title">Tetos Orçamentários</div><a href="#/categories">Gerenciar ›</a></div>
          ${budgets || '<div class="empty">Defina tetos em Categorias.</div>'}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">Metas de Economia</div><a href="#/goals">Ver metas ›</a></div>
          <div class="budget-line"><div class="top"><span>${money(goalsTotal)} guardados</span><span>meta ${money(goalsTarget)}</span></div>${progressBar(goalPct, 'indigo')}</div>
          <small style="color:var(--text-muted)">${d.goals.length} meta(s) ativa(s) · ${goalPct}% concluído</small>
        </div>
      </div>
    </div>`;
}

export function bind(root, { month }, refresh) {
  root.querySelector('[data-export]').onclick = () => api.downloadCsv(month).catch((e) => toast(e.message, 'err'));
  root.querySelectorAll('[data-pay]').forEach((b) => {
    b.onclick = async () => { await api.toggleTransaction(b.dataset.pay); toast('Conta marcada como paga'); refresh(); };
  });
}
