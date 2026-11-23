import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp, parseStatement } from '../server/app.js';

let server, base;
const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

before(async () => {
  server = createApp(openDb(':memory:', { seed: true }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

let token = null;
const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body && JSON.stringify(body),
  });
  const type = res.headers.get('content-type') ?? '';
  return { status: res.status, data: type.includes('json') ? await res.json() : await res.text() };
};

test('summary aggregates limits and spending from seed', async () => {
  const { status, data } = await call('GET', `/api/summary?month=${month}`);
  assert.equal(status, 200);
  assert.equal(data.limitCents, 420000);
  assert.equal(data.spentCents, 111600 + 61200 + 30000 + 34000 + 45000 + 14990 + 18000 + 12400);
  assert.equal(data.incomeCents, 420000);
});

test('category CRUD', async () => {
  const created = await call('POST', '/api/categories', { name: 'Pets', limitCents: 10000 });
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal((await call('PUT', `/api/categories/${id}`, { name: 'Pets 2', limitCents: 20000 })).status, 200);
  const list = await call('GET', `/api/categories?month=${month}`);
  assert.equal(list.data.find((c) => c.id === id).limitCents, 20000);
  assert.equal((await call('DELETE', `/api/categories/${id}`)).status, 200);
  assert.equal((await call('DELETE', `/api/categories/${id}`)).status, 404);
});

test('transaction is counted in its month only', async () => {
  const before = (await call('GET', `/api/summary?month=${month}`)).data.expenseCents;
  const r = await call('POST', '/api/transactions', {
    kind: 'expense', categoryId: 6, description: 'Teste', amountCents: 1000, date: `${month}-20`,
  });
  assert.equal(r.status, 201);
  assert.equal((await call('GET', `/api/summary?month=${month}`)).data.expenseCents, before + 1000);
  assert.equal((await call('GET', '/api/summary?month=1999-01')).data.expenseCents, 0);
});

test('transaction search filters by description and kind', async () => {
  const { data } = await call('GET', `/api/transactions?month=${month}&kind=expense&q=alug`);
  assert.equal(data.length, 1);
  assert.equal(data[0].description, 'Aluguel');
});

test('validation rejects bad input', async () => {
  assert.equal((await call('POST', '/api/transactions', { kind: 'x' })).status, 400);
  assert.equal((await call('POST', '/api/transactions', { kind: 'expense', description: 'a', amountCents: -5, date: `${month}-01` })).status, 400);
  assert.equal((await call('POST', '/api/transactions', { kind: 'expense', description: 'a', amountCents: 5, date: `${month}-01`, status: 'x' })).status, 400);
  assert.equal((await call('POST', '/api/categories', { name: '' })).status, 400);
  assert.equal((await call('GET', '/api/summary?month=abc')).status, 400);
});

test('toggle changes pending status and filters by status', async () => {
  const pending = (await call('GET', `/api/transactions?month=${month}&status=pending`)).data;
  assert.equal(pending.length, 2);
  const id = pending[0].id;
  assert.equal((await call('POST', `/api/transactions/${id}/toggle`)).data.status, 'paid');
  assert.equal((await call('GET', `/api/transactions?month=${month}&status=pending`)).data.length, 1);
  assert.equal((await call('POST', `/api/transactions/${id}/toggle`)).data.status, 'pending');
  assert.equal((await call('POST', '/api/transactions/99999/toggle')).status, 404);
});

test('dashboard returns balance, upcoming bills and six-month flow', async () => {
  const { status, data } = await call('GET', `/api/dashboard?month=${month}`);
  assert.equal(status, 200);
  assert.equal(data.flow.length, 6);
  assert.equal(data.flow.at(-1).month, month);
  assert.ok(data.upcoming.every((u) => u.amountCents > 0));
  assert.equal(data.upcoming.length, 2);
  assert.ok(data.goals.length >= 1);
  assert.ok(data.balanceCents > 0);
});

test('reports aggregate period and distribution', async () => {
  const { data } = await call('GET', `/api/reports?month=${month}&months=12`);
  assert.equal(data.flow.length, 12);
  assert.equal(data.months, 12);
  assert.ok(data.distribution.length > 0);
  const six = (await call('GET', `/api/reports?month=${month}`)).data;
  assert.equal(six.flow.length, 6);
  assert.equal(six.flow[0].rate, Math.round((six.flow[0].balanceCents / six.flow[0].incomeCents) * 100));
});

test('goals CRUD and deposits', async () => {
  const created = await call('POST', '/api/goals', { name: 'Carro', targetCents: 100000 });
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal((await call('POST', `/api/goals/${id}/deposit`, { amountCents: 25000 })).data.savedCents, 25000);
  assert.equal((await call('POST', `/api/goals/${id}/deposit`, { amountCents: -30000 })).status, 400);
  assert.equal((await call('POST', `/api/goals/${id}/deposit`, { amountCents: 0 })).status, 400);
  assert.equal((await call('PUT', `/api/goals/${id}`, { name: 'Carro 2', targetCents: 200000, savedCents: 25000 })).status, 200);
  assert.equal((await call('DELETE', `/api/goals/${id}`)).status, 200);
  assert.equal((await call('DELETE', `/api/goals/${id}`)).status, 404);
  assert.equal((await call('POST', '/api/goals', { name: 'x', targetCents: 0 })).status, 400);
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

test('import endpoint stores rows and rejects empty files', async () => {
  const before = (await call('GET', '/api/transactions?month=2026-02')).data.length;
  const r = await call('POST', '/api/import', { csv: '10/02/2026;Padaria;-23,50\n11/02/2026;Pix recebido;100,00' });
  assert.equal(r.data.imported, 2);
  assert.equal((await call('GET', '/api/transactions?month=2026-02')).data.length, before + 2);
  assert.equal((await call('POST', '/api/import', { csv: 'nada aqui' })).status, 400);
});

test('export returns CSV with BOM and header', async () => {
  const bytes = new Uint8Array(await (await fetch(`${base}/api/export?month=${month}`)).arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'BOM UTF-8 para o Excel');
  const { status, data } = await call('GET', `/api/export?month=${month}`);
  assert.equal(status, 200);
  assert.ok(data.replace(/^﻿/, '').startsWith('Data;Tipo;Descrição;Categoria;Valor;Situação'));
  assert.match(data, /Aluguel/);
  assert.equal((await call('GET', '/api/export?month=zzz')).status, 400);
});

test('backup and restore round-trip', async () => {
  const backup = (await call('GET', '/api/backup')).data;
  assert.equal(backup.app, 'finhub');
  const count = backup.transactions.length;
  await call('POST', '/api/transactions', { kind: 'expense', description: 'Extra', amountCents: 100, date: `${month}-02` });
  assert.equal((await call('POST', '/api/restore', { data: backup })).status, 200);
  assert.equal((await call('GET', '/api/backup')).data.transactions.length, count);
  assert.equal((await call('POST', '/api/restore', { data: { app: 'outro' } })).status, 400);
  const broken = { ...backup, transactions: [{ kind: 'expense', description: 'x', amountCents: -1, date: '2026-01-01' }] };
  assert.equal((await call('POST', '/api/restore', { data: broken })).status, 400);
  assert.equal((await call('GET', '/api/backup')).data.transactions.length, count, 'falha deve reverter tudo');
});

test('profile can be renamed', async () => {
  assert.equal((await call('PUT', '/api/profile', { name: 'Família Silva' })).status, 200);
  assert.equal((await call('GET', '/api/profile')).data.name, 'Família Silva');
  assert.equal((await call('PUT', '/api/profile', { name: '' })).status, 400);
});

test('PIN protects the API and can be changed and removed', async () => {
  assert.equal((await call('GET', '/api/auth/status')).data.hasPin, false);
  assert.equal((await call('POST', '/api/auth/pin', { pin: '12' })).status, 400);
  const set = await call('POST', '/api/auth/pin', { pin: '2468' });
  assert.equal(set.status, 200);
  const goodToken = set.data.token;

  token = null;
  assert.equal((await call('GET', '/api/auth/status')).data.unlocked, false);
  assert.equal((await call('GET', `/api/summary?month=${month}`)).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { pin: '0000' })).status, 401);

  token = (await call('POST', '/api/auth/login', { pin: '2468' })).data.token;
  assert.equal((await call('GET', `/api/summary?month=${month}`)).status, 200);

  assert.equal((await call('POST', '/api/auth/pin', { pin: '1357', current: 'errado' })).status, 401);
  assert.equal((await call('POST', '/api/auth/pin/remove', { current: '2468' })).status, 200);
  token = null;
  assert.equal((await call('GET', `/api/summary?month=${month}`)).status, 200);
  assert.ok(goodToken);
});

test('serves static index', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /html/);
  assert.match(await res.text(), /FinHub/);
});
