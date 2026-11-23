import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, memoryStorage, parseStatement, STORAGE_KEY } from '../docs/js/store.js';
import { createStaticServer } from '../server/index.js';

const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const newStore = () => createStore(memoryStorage());
const throwsMsg = (fn, re) => assert.throws(fn, (e) => re.test(e.message));

test('summary aggregates limits and spending from seed', () => {
  const s = newStore().summary(month);
  assert.equal(s.limitCents, 420000);
  assert.equal(s.spentCents, 111600 + 61200 + 30000 + 34000 + 45000 + 14990 + 18000 + 12400);
  assert.equal(s.incomeCents, 420000);
});

test('category CRUD; deleting keeps transactions without category', () => {
  const st = newStore();
  const { id } = st.createCategory({ name: 'Pets', limitCents: 10000 });
  st.updateCategory(id, { name: 'Pets 2', limitCents: 20000 });
  assert.equal(st.categories(month).find((c) => c.id === id).limitCents, 20000);
  const tx = st.createTransaction({ kind: 'expense', categoryId: id, description: 'Ração', amountCents: 500, date: `${month}-03` });
  st.deleteCategory(id);
  assert.equal(st.transactions({ month, q: 'Ração' }).find((t) => t.id === tx.id).categoryId, null);
  throwsMsg(() => st.deleteCategory(id), /não encontrada/);
});

test('transaction is counted in its month only', () => {
  const st = newStore();
  const before = st.summary(month).expenseCents;
  st.createTransaction({ kind: 'expense', categoryId: 6, description: 'Teste', amountCents: 1000, date: `${month}-20` });
  assert.equal(st.summary(month).expenseCents, before + 1000);
  assert.equal(st.summary('1999-01').expenseCents, 0);
});

test('transaction search filters by description, kind and status', () => {
  const st = newStore();
  const found = st.transactions({ month, kind: 'expense', q: 'alug' });
  assert.equal(found.length, 1);
  assert.equal(found[0].description, 'Aluguel');
  assert.equal(st.transactions({ month, status: 'pending' }).length, 2);
});

test('validation rejects bad input', () => {
  const st = newStore();
  throwsMsg(() => st.createTransaction({ kind: 'x' }), /kind/);
  throwsMsg(() => st.createTransaction({ kind: 'expense', description: 'a', amountCents: -5, date: `${month}-01` }), /amountCents/);
  throwsMsg(() => st.createTransaction({ kind: 'expense', description: 'a', amountCents: 5, date: `${month}-01`, status: 'x' }), /status/);
  throwsMsg(() => st.createTransaction({ kind: 'expense', description: 'a', amountCents: 5, date: 'ontem' }), /date/);
  throwsMsg(() => st.createTransaction({ kind: 'expense', description: 'a', amountCents: 5, date: `${month}-01`, categoryId: 999 }), /categoryId/);
  throwsMsg(() => st.createCategory({ name: '' }), /name/);
  throwsMsg(() => st.summary('abc'), /month/);
});

test('toggle changes pending status', () => {
  const st = newStore();
  const [first] = st.transactions({ month, status: 'pending' });
  assert.equal(st.toggleTransaction(first.id).status, 'paid');
  assert.equal(st.transactions({ month, status: 'pending' }).length, 1);
  assert.equal(st.toggleTransaction(first.id).status, 'pending');
  throwsMsg(() => st.toggleTransaction(99999), /não encontrada/);
});

test('dashboard returns balance, upcoming bills and six-month flow', () => {
  const d = newStore().dashboard(month);
  assert.equal(d.flow.length, 6);
  assert.equal(d.flow.at(-1).month, month);
  assert.equal(d.upcoming.length, 2);
  assert.ok(d.upcoming[0].date <= d.upcoming[1].date);
  assert.equal(d.pendingCount, 2);
  assert.ok(d.goals.length >= 1);
  assert.ok(d.balanceCents > 0);
  assert.equal(d.recent.length, 6);
});

test('reports aggregate period and distribution', () => {
  const st = newStore();
  const r12 = st.reports(month, 12);
  assert.equal(r12.flow.length, 12);
  assert.equal(r12.months, 12);
  assert.ok(r12.distribution.length > 0);
  assert.ok(r12.distribution[0].spentCents >= r12.distribution.at(-1).spentCents);
  const r6 = st.reports(month);
  assert.equal(r6.flow.length, 6);
  assert.equal(r6.flow[0].rate, Math.round((r6.flow[0].balanceCents / r6.flow[0].incomeCents) * 100));
});

test('goals CRUD and deposits', () => {
  const st = newStore();
  const { id } = st.createGoal({ name: 'Carro', targetCents: 100000 });
  assert.equal(st.depositGoal(id, 25000).savedCents, 25000);
  throwsMsg(() => st.depositGoal(id, -30000), /insuficiente/);
  throwsMsg(() => st.depositGoal(id, 0), /amountCents/);
  st.updateGoal(id, { name: 'Carro 2', targetCents: 200000, savedCents: 25000 });
  assert.equal(st.goals().find((g) => g.id === id).name, 'Carro 2');
  st.deleteGoal(id);
  throwsMsg(() => st.deleteGoal(id), /não encontrada/);
  throwsMsg(() => st.createGoal({ name: 'x', targetCents: 0 }), /targetCents/);
});

test('statement parser handles formats, signs and bad lines', () => {
  const csv = 'data;descrição;valor\n05/03/2026;Mercado;-152,90\n2026-03-10;Salário;4.200,00\nlixo\n11/03/2026;;10,00';
  const { rows, skipped } = parseStatement(csv);
  assert.equal(rows.length, 2);
  assert.equal(skipped, 2);
  assert.deepEqual(rows[0], { kind: 'expense', description: 'Mercado', amountCents: 15290, date: '2026-03-05', categoryId: null });
  assert.equal(rows[1].kind, 'income');
  assert.equal(rows[1].amountCents, 420000);
});

test('import stores rows and rejects empty files', () => {
  const st = newStore();
  const before = st.transactions({ month: '2026-02' }).length;
  const r = st.importStatement('10/02/2026;Padaria;-23,50\n11/02/2026;Pix recebido;100,00');
  assert.equal(r.imported, 2);
  assert.equal(st.transactions({ month: '2026-02' }).length, before + 2);
  throwsMsg(() => st.importStatement('nada aqui'), /Nenhum lançamento/);
});

test('export returns CSV with BOM and header', () => {
  const st = newStore();
  const csv = st.exportCsv(month);
  assert.ok(csv.startsWith('﻿Data;Tipo;Descrição;Categoria;Valor;Situação'));
  assert.match(csv, /Aluguel/);
  assert.match(csv, /-800,00/);
  assert.ok(st.exportCsv().split('\r\n').length > st.exportCsv(month).split('\r\n').length);
  throwsMsg(() => st.exportCsv('zzz'), /month/);
});

test('backup and restore round-trip, failures leave data untouched', () => {
  const st = newStore();
  const backup = st.backup();
  assert.equal(backup.app, 'finhub');
  const count = backup.transactions.length;
  st.createTransaction({ kind: 'expense', description: 'Extra', amountCents: 100, date: `${month}-02` });
  st.restore(JSON.parse(JSON.stringify(backup)));
  assert.equal(st.backup().transactions.length, count);
  throwsMsg(() => st.restore({ app: 'outro' }), /inválido/);
  const broken = { ...backup, transactions: [{ kind: 'expense', description: 'x', amountCents: -1, date: '2026-01-01' }] };
  throwsMsg(() => st.restore(broken), /amountCents/);
  assert.equal(st.backup().transactions.length, count, 'falha deve manter os dados');
});

test('clearData removes transactions and goals but keeps categories', () => {
  const st = newStore();
  st.clearData();
  assert.equal(st.transactions({ month }).length, 0);
  assert.equal(st.goals().length, 0);
  assert.ok(st.categories(month).length > 0);
  assert.equal(st.createTransaction({ kind: 'income', description: 'Novo', amountCents: 100, date: `${month}-01` }).id, 1);
});

test('data persists across store instances', () => {
  const storage = memoryStorage();
  const a = createStore(storage);
  a.saveProfile('Família Silva');
  a.createTransaction({ kind: 'income', description: 'Bônus', amountCents: 5000, date: `${month}-09` });
  const b = createStore(storage);
  assert.equal(b.profile().name, 'Família Silva');
  assert.equal(b.transactions({ month, q: 'Bônus' }).length, 1);
  assert.equal(b.isFresh(), false);
  assert.ok(storage.getItem(STORAGE_KEY));
  throwsMsg(() => a.saveProfile(''), /name/);
});

test('a failing storage rolls the change back', () => {
  const storage = memoryStorage();
  const st = createStore(storage);
  const before = st.transactions({ month }).length;
  storage.setItem = () => { throw new Error('quota'); };
  throwsMsg(() => st.createTransaction({ kind: 'income', description: 'X', amountCents: 1, date: `${month}-01` }), /salvar/);
  assert.equal(st.transactions({ month }).length, before);
});

test('PIN set, verify, throttle and remove', async () => {
  const st = newStore();
  assert.equal(st.hasPin(), false);
  await assert.rejects(() => st.setPin('12'), /4 a 8/);
  await st.setPin('2468');
  assert.equal(st.hasPin(), true);
  await st.verifyPin('2468');
  await assert.rejects(() => st.verifyPin('0000'), /incorreto/);
  for (let i = 0; i < 4; i += 1) await assert.rejects(() => st.verifyPin('0000'));
  await assert.rejects(() => st.verifyPin('2468'), /Muitas tentativas/);
  st.removePin();
  assert.equal(st.hasPin(), false);
});

test('dev static server serves the app shell and blocks traversal', async () => {
  const server = createStaticServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /FinHub/);
  assert.equal((await fetch(`${base}/js/store.js`)).status, 200);
  assert.equal((await fetch(`${base}/nao-existe.js`)).status, 404);
  server.close();
});
