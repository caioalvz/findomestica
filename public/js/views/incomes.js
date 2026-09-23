import { transactionsView } from './transactions.js';

export const { render, bind } = transactionsView({
  kind: 'income',
  title: 'Receitas',
  sub: 'Registre as entradas de dinheiro da casa no mês.',
  newLabel: 'Nova Receita',
  totalLabel: 'Total de Receitas',
  tile: 'bolt',
  tileTone: 'green',
});
