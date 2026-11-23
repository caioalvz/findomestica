import { api } from '../api.js';
import {
  COLOR_KEYS, COLOR_LABELS, confirmBox, esc, fmtDate, fromCents, icon, localDate, metricCard, money, openModal,
  pageHead, progressBar, toCents, toast,
} from '../ui.js';

let list = [];

function monthsLeft(deadline) {
  if (!deadline) return null;
  const now = new Date();
  const end = new Date(`${deadline}T00:00:00`);
  const n = (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth();
  return Math.max(n, 0);
}

export async function render() {
  list = await api.goals();
  const saved = list.reduce((a, g) => a + g.savedCents, 0);
  const target = list.reduce((a, g) => a + g.targetCents, 0);
  const pct = target ? Math.round((saved / target) * 100) : 0;
  const done = list.filter((g) => g.savedCents >= g.targetCents).length;

  const cards = list.map((g) => {
    const p = Math.round((g.savedCents / g.targetCents) * 100);
    const left = Math.max(g.targetCents - g.savedCents, 0);
    const ml = monthsLeft(g.deadline);
    const hint = g.savedCents >= g.targetCents ? '🎉 Meta atingida!'
      : ml === null ? `Faltam ${money(left)}`
        : ml === 0 ? `Faltam ${money(left)} · prazo neste mês`
          : `Poupe ${money(Math.ceil(left / ml))}/mês para chegar lá`;
    return `
    <div class="card">
      <div class="goal-top">
        <span class="icon-tile tone-${g.color}">${icon('target')}</span>
        <div class="grow"><div class="cat-name">${esc(g.name)}</div><div class="cat-sub">${g.deadline ? `Prazo: ${fmtDate(g.deadline)}` : 'Sem prazo definido'}</div></div>
        <span class="badge ${p >= 100 ? 'green' : 'indigo'}">${p}%</span>
      </div>
      <div class="cat-stats">
        <div><small>Guardado</small><strong>${money(g.savedCents)}</strong></div>
        <div style="text-align:right"><small>Meta</small><strong>${money(g.targetCents)}</strong></div>
      </div>
      ${progressBar(p, g.color)}
      <div class="cat-foot"><span>${hint}</span></div>
      <div class="card-actions">
        <button class="btn small success" data-deposit="${g.id}">+ Aportar</button>
        <button class="btn small" data-withdraw="${g.id}">Resgatar</button>
        <button class="btn small" data-edit="${g.id}">Editar</button>
        <button class="btn small danger" data-del="${g.id}">Excluir</button>
      </div>
    </div>`;
  }).join('');

  return `
    ${pageHead({
      eyebrow: 'Planejamento doméstico • <b>Metas de economia</b>', title: 'Metas de Economia',
      sub: 'Crie objetivos, faça aportes e acompanhe quanto falta para realizar cada sonho da família.',
      actions: '<button class="btn primary" data-new>+ Nova Meta</button>',
    })}
    <div class="grid cols-3">
      ${metricCard({ label: 'Total Guardado', value: money(saved), valueTone: 'green', tile: 'wallet', tileTone: 'green', foot: `${list.length} meta(s) ativa(s)` })}
      ${metricCard({ label: 'Objetivo Total', value: money(target), tile: 'target', tileTone: 'indigo', foot: `<span class="badge indigo">${pct}%</span> concluído` })}
      ${metricCard({ label: 'Metas Concluídas', value: String(done), tile: 'check', tileTone: 'purple', foot: `de ${list.length} metas` })}
    </div>
    <div class="section-head"><h2>Suas Metas</h2></div>
    <div class="grid cols-3">${cards || '<div class="card empty">Nenhuma meta ainda. Crie a primeira!</div>'}</div>`;
}

function form(g = {}) {
  return `
    <div class="field"><label>Nome da meta</label><input name="name" required maxlength="80" value="${esc(g.name)}" placeholder="Ex.: Viagem de férias"></div>
    <div class="field-row">
      <div class="field"><label>Valor da meta (R$)</label><input name="target" inputmode="decimal" required value="${g.targetCents ? fromCents(g.targetCents) : ''}"></div>
      <div class="field"><label>Já guardado (R$)</label><input name="saved" inputmode="decimal" value="${fromCents(g.savedCents ?? 0)}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Prazo (opcional)</label><input type="date" name="deadline" min="${localDate()}" value="${g.deadline ?? ''}"></div>
      <div class="field"><label>Cor</label><select name="color">${COLOR_KEYS.map((k) => `<option value="${k}" ${k === (g.color ?? 'indigo') ? 'selected' : ''}>${COLOR_LABELS[k]}</option>`).join('')}</select></div>
    </div>`;
}

export function bind(root, state, refresh) {
  const save = (id) => async (f) => {
    const targetCents = toCents(f.target);
    const savedCents = toCents(f.saved || '0');
    if (!Number.isInteger(targetCents) || targetCents <= 0) throw new Error('Valor da meta inválido');
    if (!Number.isInteger(savedCents) || savedCents < 0) throw new Error('Valor guardado inválido');
    await api.saveGoal({ id, name: f.name, targetCents, savedCents, deadline: f.deadline || null, color: f.color });
    toast('Meta salva');
    refresh();
  };
  const moveMoney = (g, sign) => openModal({
    title: `${sign > 0 ? 'Aportar em' : 'Resgatar de'} “${g.name}”`,
    submitLabel: sign > 0 ? 'Aportar' : 'Resgatar',
    body: `<div class="field"><label>Valor (R$)</label><input name="amount" inputmode="decimal" required placeholder="0,00"></div>`,
    onSubmit: async (f) => {
      const cents = toCents(f.amount);
      if (!Number.isInteger(cents) || cents <= 0) throw new Error('Valor inválido');
      await api.depositGoal(g.id, sign * cents);
      toast(sign > 0 ? 'Aporte registrado' : 'Resgate registrado');
      refresh();
    },
  });
  const goal = (b) => list.find((x) => x.id === Number(b.dataset.deposit ?? b.dataset.withdraw ?? b.dataset.edit));

  root.querySelector('[data-new]').onclick = () => openModal({ title: 'Nova Meta', body: form(), onSubmit: save() });
  root.querySelectorAll('[data-deposit]').forEach((b) => { b.onclick = () => moveMoney(goal(b), 1); });
  root.querySelectorAll('[data-withdraw]').forEach((b) => { b.onclick = () => moveMoney(goal(b), -1); });
  root.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => { const g = goal(b); openModal({ title: 'Editar Meta', body: form(g), onSubmit: save(g.id) }); };
  });
  root.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (await confirmBox('Excluir esta meta?')) { await api.deleteGoal(b.dataset.del); toast('Meta excluída'); refresh(); }
    };
  });
}
