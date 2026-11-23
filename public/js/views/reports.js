import { api } from '../api.js';
import {
  esc, eyebrow, groupedBars, icon, metricCard, money, monthLabel, pageHead, progressBar, tabs, toast,
} from '../ui.js';

let months = 6;

function diagnosis(avgRate, topShare, topName) {
  if (avgRate >= 20) return { tone: 'green', title: 'Orçamento saudável', text: `Você poupa em média ${avgRate}% da renda — acima da meta de 20%. Considere direcionar o excedente para suas metas.` };
  if (avgRate >= 10) return { tone: 'amber', title: 'Atenção ao equilíbrio', text: `A poupança média está em ${avgRate}%. Revise ${topName ? `os gastos com ${topName} (${topShare}% das despesas)` : 'as despesas variáveis'} para chegar a 20%.` };
  return { tone: 'red', title: 'Equilíbrio em risco', text: `A poupança média é de apenas ${avgRate}%. ${topName ? `${topName} concentra ${topShare}% dos gastos` : 'Reduza despesas'} — comece cortando por aí.` };
}

export async function render({ month }) {
  const r = await api.reports(month, months);
  const income = r.flow.reduce((a, f) => a + f.incomeCents, 0);
  const expense = r.flow.reduce((a, f) => a + f.expenseCents, 0);
  const saved = income - expense;
  const avgRate = income ? Math.round((saved / income) * 100) : 0;
  const best = [...r.flow].sort((a, b) => b.balanceCents - a.balanceCents)[0];
  const totalSpent = r.distribution.reduce((a, d) => a + d.spentCents, 0) || 1;
  const top = r.distribution[0];
  const dx = diagnosis(avgRate, top ? Math.round((top.spentCents / totalSpent) * 100) : 0, top?.name);
  const categorizedPct = r.total ? Math.round(((r.total - r.uncategorized) / r.total) * 100) : 100;

  const dist = r.distribution.map((d) => {
    const pct = Math.round((d.spentCents / totalSpent) * 100);
    return `<div class="budget-line"><div class="top"><span><i class="dot" style="background:var(--${d.color === 'gray' ? 'gray' : d.color})"></i>${esc(d.name)}</span><span>${pct}% · ${money(d.spentCents)}</span></div>${progressBar(pct, d.color)}</div>`;
  }).join('');

  const rows = [...r.flow].reverse().map((f) => `
    <tr>
      <td>${monthLabel(f.month)}</td>
      <td class="num pos">${money(f.incomeCents)}</td>
      <td class="num neg">${money(f.expenseCents)}</td>
      <td class="num ${f.balanceCents >= 0 ? 'pos' : 'neg'}">${f.balanceCents >= 0 ? '+' : '−'} ${money(Math.abs(f.balanceCents))}</td>
      <td class="num">${f.rate}%</td>
      <td><span class="badge ${f.balanceCents >= 0 ? 'green' : 'red'}">${f.balanceCents >= 0 ? 'Positivo' : 'Déficit'}</span></td>
    </tr>`).join('');

  return `
    ${pageHead({
      eyebrow: eyebrow(month), title: 'Relatórios & Fechamento Financeiro',
      sub: 'Evolução, distribuição de gastos e demonstrativo de fechamento do período.',
      actions: `${tabs([['6', '6 meses'], ['12', '12 meses']], String(months))}
        <button class="btn" data-csv>${icon('download')}CSV</button>
        <button class="btn primary" data-print>${icon('print')}Exportar PDF</button>`,
    })}
    <div class="grid cols-4">
      ${metricCard({ label: 'Economia Acumulada', value: money(saved), valueTone: saved >= 0 ? 'green' : 'red', tile: 'wallet', tileTone: 'green', foot: `últimos ${r.months} meses` })}
      ${metricCard({ label: 'Média Mensal de Economia', value: money(Math.round(saved / r.months)), tile: 'trend', tileTone: 'indigo', foot: `${r.months} meses analisados` })}
      ${metricCard({ label: 'Taxa de Poupança Média', value: `${avgRate}%`, tile: 'star', tileTone: 'purple', foot: `<span class="badge ${dx.tone}">${dx.title}</span>` })}
      ${metricCard({ label: 'Melhor Mês', value: best ? monthLabel(best.month) : '—', tile: 'check', tileTone: 'blue', foot: best ? `economia de ${money(best.balanceCents)}` : '' })}
    </div>
    <div class="grid wide-left">
      <div class="card">
        <div class="card-head"><div class="card-title">Evolução Mensal<small>Comparativo direto de receitas e despesas</small></div></div>
        ${groupedBars(r.flow)}
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title">Distribuição de Gastos<small>Total desembolsado: ${money(r.distribution.reduce((a, d) => a + d.spentCents, 0))}</small></div></div>
        ${dist || '<div class="empty">Sem despesas no período.</div>'}
      </div>
    </div>
    <div class="section-head"><h2>Demonstrativo de Fechamento</h2></div>
    <div class="card">
      <table class="table">
        <thead><tr><th>Mês de competência</th><th class="num">Receitas</th><th class="num">Despesas</th><th class="num">Saldo líquido</th><th class="num">Taxa de poupança</th><th>Situação</th></tr></thead>
        <tbody>
          ${rows}
          <tr class="total"><td>Consolidado (${r.months} meses)</td><td class="num">${money(income)}</td><td class="num">${money(expense)}</td><td class="num">${money(saved)}</td><td class="num">${avgRate}%</td><td></td></tr>
        </tbody>
      </table>
    </div>
    <div class="grid cols-2">
      <div class="card callout">
        <span class="icon-tile tone-${dx.tone === 'green' ? 'green' : dx.tone === 'amber' ? 'orange' : 'pink'}">${icon(dx.tone === 'green' ? 'check' : 'alert')}</span>
        <div><strong>Diagnóstico de Equilíbrio — ${dx.title}</strong><p>${esc(dx.text)}</p></div>
      </div>
      <div class="card callout">
        <span class="icon-tile tone-indigo">${icon('list')}</span>
        <div><strong>Integridade dos Lançamentos</strong>
          <p>${r.total} lançamentos no período, ${categorizedPct}% categorizados${r.uncategorized ? ` (${r.uncategorized} sem categoria)` : ''} e ${r.pending} pendente(s).</p></div>
      </div>
    </div>`;
}

export function bind(root, { month }, refresh) {
  root.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { months = Number(b.dataset.tab); refresh(); }; });
  root.querySelector('[data-csv]').onclick = () => api.downloadCsv('').catch((e) => toast(e.message, 'err'));
  root.querySelector('[data-print]').onclick = () => window.print();
}
