import { api } from '../api.js';
import { esc, eyebrow, metricCard, money, pageHead } from '../ui.js';

export async function render({ month }) {
  const s = await api.summary(month);
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const byDay = new Map(s.daily.map((d) => [Number(d.date.slice(8)), d.cents]));
  const max = Math.max(1, ...byDay.values());
  const bars = Array.from({ length: days }, (_, i) => {
    const v = byDay.get(i + 1) ?? 0;
    return `<div class="bar" style="height:${(v / max) * 100}%" title="Dia ${i + 1}: ${money(v)}"></div>`;
  }).join('');
  const labels = Array.from({ length: days }, (_, i) => `<span>${(i + 1) % 5 === 1 ? i + 1 : ''}</span>`).join('');

  const share = [...s.categories].filter((c) => c.spentCents > 0).sort((a, b) => b.spentCents - a.spentCents);
  const total = share.reduce((a, c) => a + c.spentCents, 0) || 1;
  const rows = share.map((c) => {
    const pct = Math.round((c.spentCents / total) * 100);
    return `<div class="hrow"><span class="label">${esc(c.name)}</span><div class="progress"><i style="width:${pct}%"></i></div><span class="val">${pct}% · ${money(c.spentCents)}</span></div>`;
  }).join('');

  const days_ = byDay.size || 1;
  return `
    ${pageHead({ eyebrow: eyebrow(month), title: 'Relatórios', sub: 'Distribuição e evolução dos gastos ao longo do mês.' })}
    <div class="grid cols-3">
      ${metricCard({ label: 'Total Gasto', value: money(s.expenseCents), tile: 'cart', tileTone: 'pink', foot: 'no mês' })}
      ${metricCard({ label: 'Média por Dia com Gasto', value: money(Math.round(s.expenseCents / days_)), tile: 'star', tileTone: 'indigo', foot: `${byDay.size} dias com gastos` })}
      ${metricCard({ label: 'Poupança', value: money(s.incomeCents - s.expenseCents), valueTone: s.incomeCents >= s.expenseCents ? 'green' : 'red', tile: 'bolt', tileTone: 'green', foot: 'receitas − despesas' })}
    </div>
    <div class="section-head"><h2>Gastos por dia</h2></div>
    <div class="card"><div class="bars">${bars}</div><div class="bar-labels">${labels}</div></div>
    <div class="section-head"><h2>Participação por categoria</h2></div>
    <div class="card">${rows || '<div class="empty">Sem dados neste mês.</div>'}</div>`;
}
