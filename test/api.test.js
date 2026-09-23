import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';

let server, base;
const month = new Date().toISOString().slice(0, 7);

before(async () => {
  server = createApp(openDb(':memory:', { seed: true }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
};

test('summary aggregates limits and spending from seed', async () => {
  const { status, data } = await call('GET', `/api/summary?month=${month}`);
  assert.equal(status, 200);
  assert.equal(data.limitCents, 420000);
  assert.equal(data.spentCents, 111600 + 61200 + 30000 + 34000 + 45000 + 14990);
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
  assert.equal((await call('POST', '/api/categories', { name: '' })).status, 400);
  assert.equal((await call('GET', '/api/summary?month=abc')).status, 400);
});

test('serves static index', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /html/);
});
