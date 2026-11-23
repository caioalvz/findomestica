import { api } from './api.js';
import { esc, fromCents, localDate, openModal, thisMonth, toCents, toast } from './ui.js';

const KIND_LABEL = { expense: 'Despesa', income: 'Receita' };

const categoryOptions = (cats, kind, selected) => cats
  .filter((c) => c.type === kind)
  .map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

/**
 * Abre o modal de lançamento. `kind` fixo esconde o seletor de tipo;
 * sem `kind` o usuário escolhe entre despesa e receita.
 */
export async function openTransactionModal({ kind, tx, month, onDone }) {
  const cats = await api.categories(month);
  const current = tx?.kind ?? kind ?? 'expense';
  const defaultDate = month === thisMonth() ? localDate() : `${month}-01`;

  const body = `
    ${kind || tx ? `<input type="hidden" name="kind" value="${current}">` : `
      <div class="field"><label>Tipo</label>
        <select name="kind">${Object.entries(KIND_LABEL).map(([k, l]) => `<option value="${k}" ${k === current ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>`}
    <div class="field"><label>Descrição</label><input name="description" required maxlength="120" value="${esc(tx?.description)}"></div>
    <div class="field-row">
      <div class="field"><label>Valor (R$)</label><input name="amount" inputmode="decimal" required placeholder="0,00" value="${tx ? fromCents(tx.amountCents) : ''}"></div>
      <div class="field"><label>Data / vencimento</label><input type="date" name="date" required value="${tx?.date ?? defaultDate}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Categoria</label><select name="categoryId"></select></div>
      <div class="field"><label>Situação</label>
        <select name="status">
          <option value="paid" ${tx?.status !== 'pending' ? 'selected' : ''}>Concluído (pago / recebido)</option>
          <option value="pending" ${tx?.status === 'pending' ? 'selected' : ''}>Pendente (a pagar / a receber)</option>
        </select>
      </div>
    </div>`;

  const form = openModal({
    title: tx ? 'Editar lançamento' : kind ? `Nova ${KIND_LABEL[kind]}` : 'Novo Lançamento',
    body,
    onSubmit: async (f) => {
      const amountCents = toCents(f.amount);
      if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('Valor inválido');
      await api.saveTransaction({
        id: tx?.id, kind: f.kind, description: f.description, amountCents, date: f.date,
        status: f.status, categoryId: f.categoryId ? Number(f.categoryId) : null,
      });
      toast(tx ? 'Lançamento atualizado' : 'Lançamento salvo');
      onDone?.();
    },
  });

  const select = form.querySelector('[name=categoryId]');
  const fill = (k) => {
    select.innerHTML = `<option value="">Sem categoria</option>${categoryOptions(cats, k, tx?.categoryId)}`;
  };
  fill(current);
  form.querySelector('select[name=kind]')?.addEventListener('change', (e) => fill(e.target.value));
}
