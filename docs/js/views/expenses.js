import { transactionsView } from './transactions.js';

export const { render, bind } = transactionsView({
  kind: 'expense',
  title: 'Controle de Despesas',
  sub: 'Registre, acompanhe vencimentos e marque como pago os gastos da casa.',
  newLabel: 'Nova Despesa',
  labels: {
    total: 'Total de Despesas', done: 'Já pago', doneFoot: 'contas pagas', pending: 'A pagar', pendingFoot: 'contas em aberto',
  },
  tile: 'cart',
  tileTone: 'pink',
});
