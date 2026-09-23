import { transactionsView } from './transactions.js';

export const { render, bind } = transactionsView({
  kind: 'expense',
  title: 'Despesas',
  sub: 'Registre e acompanhe todos os gastos da casa no mês.',
  newLabel: 'Nova Despesa',
  totalLabel: 'Total de Despesas',
  tile: 'cart',
  tileTone: 'pink',
});
