import { api } from '../api.js';
import { budgetStatus, esc, eyebrow, metricCard, money, pageHead, progressBar } from '../ui.js';

export async function render({ month }) {
  const s = await api.summary(month);
  const balance = s.incomeCents - s.expenseCents;
  const top = [...s.categories].sort((a, b) => b.spentCents - a.spentCents).slice(0, 5);

  const rows = top.map((c) => {
    const st = budgetStatus(c.spentCents, c.limitCents);
    return `<div class="hrow"><span class="label">${esc(c.name)}</span>${progressBar(st.pct, st.tone)}<span class="val">${money(c.spentCents)}</span></div>`;
  }).join('');

  return `
    ${pageHead({ eyebrow: eyebrow(month), title: 'Visão Geral', sub: 'Resumo das receitas, despesas e saldo do mês.' })}
    <div class="grid cols-3">
      ${metricCard({ label: 'Receitas', value: money(s.incomeCents), tile: 'bolt', tileTone: 'green', foot: 'entradas no mês' })}
      ${metricCard({ label: 'Despesas', value: money(s.expenseCents), tile: 'cart', tileTone: 'pink', foot: 'saídas no mês' })}
      ${metricCard({ label: 'Saldo do Mês', value: money(balance), valueTone: balance >= 0 ? 'green' : 'red', tile: 'star', tileTone: 'indigo', foot: 'receitas − despesas' })}
    </div>
    <div class="section-head"><h2>Maiores gastos por categoria</h2></div>
    <div class="card">${rows || '<div class="empty">Sem dados neste mês.</div>'}</div>`;
}
