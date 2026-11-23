import { transactionsView } from './transactions.js';

export const { render, bind } = transactionsView({
  kind: 'income',
  title: 'Controle de Receitas',
  sub: 'Salários, rendas extras e valores a receber da família.',
  newLabel: 'Nova Receita',
  labels: {
    total: 'Total de Receitas', done: 'Já recebido', doneFoot: 'entradas recebidas', pending: 'A receber', pendingFoot: 'entradas previstas',
  },
  tile: 'trend',
  tileTone: 'green',
});
