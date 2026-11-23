import { transactionsView } from './transactions.js';

export const { render, bind } = transactionsView({
  kind: 'all',
  title: 'Extrato Completo',
  sub: 'Todas as receitas e despesas do mês em um só lugar. Use a busca para filtrar.',
  newLabel: 'Novo Lançamento',
  labels: {},
});
