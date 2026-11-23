// Camada de dados do FinHub: roda inteira no navegador e persiste em localStorage.
// Não depende de DOM, então os testes a executam no Node com um storage em memória.

export const STORAGE_KEY = 'finhub:v1';
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PIN_ITERATIONS = 120000;
const MAX_FAILS = 5;
const LOCK_MS = 30 * 1000;

export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

const fail = (message) => { throw new Error(message); };
const pad = (n) => String(n).padStart(2, '0');
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nextMonth = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`;
};
const prevMonth = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${pad(mo - 1)}`;
};
const monthsBack = (m, n) => {
  const out = [m];
  while (out.length < n) out.unshift(prevMonth(out[0]));
  return out;
};

const str = (v, field, max = 80) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s || s.length > max) fail(`${field} inválido`);
  return s;
};
const cents = (v, field, { allowZero = false } = {}) => {
  if (!Number.isInteger(v) || v < 0 || (!allowZero && v === 0)) fail(`${field} inválido`);
  return v;
};
const oneOf = (v, list, field) => (list.includes(v) ? v : fail(`${field} inválido`));
const dateStr = (v, field = 'date') => {
  if (!DATE_RE.test(v ?? '') || Number.isNaN(Date.parse(v))) fail(`${field} inválida`);
  return v;
};

const parseDate = (s) => {
  const t = String(s).trim();
  if (DATE_RE.test(t)) return t;
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const parseAmount = (s) => {
  let t = String(s).replace(/R\$|\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
};
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function parseStatement(csv, categoryId = null) {
  const rows = [];
  let skipped = 0;
  const lines = String(csv).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 5000);
  lines.forEach((line, i) => {
    const parts = line.split(line.includes(';') ? ';' : ',').map((s) => s.trim().replace(/^"|"$/g, ''));
    const date = parts.length >= 3 ? parseDate(parts[0]) : null;
    if (!date && i === 0 && /data|date/i.test(parts[0])) return;
    const amount = parts.length >= 3 ? parseAmount(parts[parts.length - 1]) : NaN;
    const description = parts.slice(1, -1).join(' ').slice(0, 120).trim();
    if (!date || !description || !Number.isFinite(amount) || amount === 0) { skipped += 1; return; }
    rows.push({
      kind: amount < 0 ? 'expense' : 'income', description,
      amountCents: Math.round(Math.abs(amount) * 100), date, categoryId,
    });
  });
  return { rows, skipped };
}

// ---------- dados de exemplo ----------
const SEED_CATEGORIES = [
  ['Moradia & Contas', 'Despesa Fixa Essencial', 'expense', 'home', 'indigo', 120000],
  ['Alimentação & Mercado', 'Consumo Variável', 'expense', 'cart', 'green', 90000],
  ['Saúde & Cuidados', 'Bem-estar', 'expense', 'heart', 'pink', 50000],
  ['Transporte', 'Consumo Variável', 'expense', 'car', 'blue', 60000],
  ['Educação', 'Investimento', 'expense', 'book', 'purple', 50000],
  ['Lazer', 'Consumo Variável', 'expense', 'gift', 'orange', 50000],
  ['Salário', 'Renda fixa', 'income', 'bolt', 'green', 0],
];
// [kind, categoryId, description, amountCents, day, status]
const SEED_TX = [
  ['expense', 1, 'Aluguel', 80000, 1], ['expense', 1, 'Energia elétrica', 15000, 8],
  ['expense', 1, 'Internet', 6000, 10], ['expense', 1, 'Condomínio', 10600, 5],
  ['expense', 2, 'Supermercado', 48000, 4], ['expense', 2, 'Feira', 13200, 12],
  ['expense', 3, 'Farmácia', 15000, 9], ['expense', 3, 'Consulta', 15000, 14],
  ['expense', 4, 'Combustível', 26000, 6], ['expense', 4, 'Aplicativo de transporte', 8000, 15],
  ['expense', 5, 'Curso de inglês', 45000, 7], ['expense', 6, 'Cinema e jantar', 14990, 13],
  ['income', 7, 'Salário', 420000, 5],
  ['expense', 3, 'Plano de saúde', 18000, 28, 'pending'],
  ['expense', 6, 'Fatura do cartão', 12400, 25, 'pending'],
];
const SEED_GOALS = [
  ['Reserva de Emergência', 2000000, 850000, null, 'green'],
  ['Viagem de Férias', 800000, 320000, null, 'blue'],
  ['Notebook novo', 450000, 120000, null, 'purple'],
];

const emptyDb = () => ({
  seq: { categories: 0, transactions: 0, goals: 0 }, categories: [], transactions: [], goals: [], settings: {},
});

function seedDb(db, now) {
  const addTx = (kind, categoryId, description, amountCents, date, status = 'paid') => {
    db.seq.transactions += 1;
    db.transactions.push({ id: db.seq.transactions, kind, categoryId, description, amountCents, date, status });
  };
  for (const [name, subtitle, type, icon, color, limitCents] of SEED_CATEGORIES) {
    db.seq.categories += 1;
    db.categories.push({ id: db.seq.categories, name, subtitle, type, icon, color, limitCents });
  }
  const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  for (const [k, c, d, a, day, status] of SEED_TX) addTx(k, c, d, a, `${month}-${pad(day)}`, status);
  for (let i = 1; i <= 5; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const rows = [
      ['income', 7, 'Salário', 420000, 5],
      ['expense', 1, 'Aluguel', 80000, 1], ['expense', 1, 'Energia elétrica', 12000 + i * 700, 8],
      ['expense', 1, 'Internet', 6000, 10], ['expense', 1, 'Condomínio', 10600, 5],
      ['expense', 2, 'Supermercado', 42000 + i * 1800, 4], ['expense', 2, 'Feira', 11000 + i * 400, 12],
      ['expense', 3, 'Farmácia', 9000 + i * 1500, 9], ['expense', 4, 'Combustível', 24000 + i * 500, 6],
      ['expense', 5, 'Curso de inglês', 45000, 7], ['expense', 6, 'Lazer', 8000 + i * 2600, 13],
    ];
    for (const [k, c, desc, amount, day] of rows) addTx(k, c, desc, amount, `${m}-${pad(day)}`);
  }
  for (const [name, targetCents, savedCents, deadline, color] of SEED_GOALS) {
    db.seq.goals += 1;
    db.goals.push({ id: db.seq.goals, name, targetCents, savedCents, deadline, color });
  }
}

// ---------- PIN (bloqueio de tela) ----------
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function derive(pin, saltHex) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) fail('Este navegador não suporta o bloqueio por PIN (requer HTTPS).');
  const key = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  return toHex(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PIN_ITERATIONS }, key, 256));
}

export function createStore(storage, { seed = true, clock = () => new Date() } = {}) {
  let db = null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) db = JSON.parse(raw);
  } catch { db = null; }
  const fresh = !db;
  if (!db) {
    db = emptyDb();
    if (seed) seedDb(db, clock());
  }

  function save() {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { fail('Não foi possível salvar os dados neste navegador.'); }
  }
  if (fresh) { try { save(); } catch { /* sem armazenamento: segue em memória */ } }

  const today = () => localDate(clock());
  const thisMonth = () => today().slice(0, 7);
  const monthOf = (m) => {
    const v = m || thisMonth();
    if (!MONTH_RE.test(v)) fail('month inválido (use YYYY-MM)');
    return v;
  };
  const range = (month) => [`${month}-01`, `${nextMonth(month)}-01`];
  const inRange = (t, from, to) => t.date >= from && t.date < to;
  const sumKind = (kind, from, to) => db.transactions
    .filter((t) => t.kind === kind && inRange(t, from, to)).reduce((a, t) => a + t.amountCents, 0);
  const catOf = (id) => db.categories.find((c) => c.id === id);
  const byDateDesc = (a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1);
  const withCat = (t) => ({ ...t, categoryName: catOf(t.categoryId)?.name ?? null, categoryColor: catOf(t.categoryId)?.color ?? null });

  function listCategories(month) {
    const [from, to] = range(month);
    const spent = new Map();
    for (const t of db.transactions) {
      if (t.kind === 'expense' && inRange(t, from, to)) spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amountCents);
    }
    return db.categories.map((c) => ({ ...c, spentCents: spent.get(c.id) ?? 0 }));
  }

  const categoryInput = (b) => ({
    name: str(b.name, 'name'),
    subtitle: typeof b.subtitle === 'string' ? b.subtitle.trim().slice(0, 60) : '',
    type: oneOf(b.type ?? 'expense', ['expense', 'income'], 'type'),
    icon: str(b.icon ?? 'star', 'icon', 20),
    color: str(b.color ?? 'indigo', 'color', 20),
    limitCents: cents(b.limitCents ?? 0, 'limitCents', { allowZero: true }),
  });

  function txInput(b) {
    const kind = oneOf(b.kind, ['expense', 'income'], 'kind');
    let categoryId = null;
    if (b.categoryId != null) {
      categoryId = Number(b.categoryId);
      if (!catOf(categoryId)) fail('categoryId inexistente');
    }
    return {
      kind, categoryId, description: str(b.description, 'description', 120), amountCents: cents(b.amountCents, 'amountCents'),
      date: dateStr(b.date), status: oneOf(b.status ?? 'paid', ['paid', 'pending'], 'status'),
    };
  }

  const goalInput = (b) => ({
    name: str(b.name, 'name'), targetCents: cents(b.targetCents, 'targetCents'),
    savedCents: cents(b.savedCents ?? 0, 'savedCents', { allowZero: true }),
    deadline: b.deadline ? dateStr(b.deadline, 'deadline') : null, color: str(b.color ?? 'indigo', 'color', 20),
  });

  function flowSeries(month, n) {
    return monthsBack(month, n).map((m) => {
      const [from, to] = range(m);
      return { month: m, incomeCents: sumKind('income', from, to), expenseCents: sumKind('expense', from, to) };
    });
  }

  const insert = (table, row) => {
    db.seq[table] += 1;
    const full = { id: db.seq[table], ...row };
    db[table].push(full);
    return full;
  };
  const update = (table, id, row) => {
    const i = db[table].findIndex((x) => x.id === id);
    if (i < 0) fail('não encontrada');
    db[table][i] = { id, ...row };
    return id;
  };
  const remove = (table, id) => {
    const i = db[table].findIndex((x) => x.id === id);
    if (i < 0) fail('não encontrada');
    db[table].splice(i, 1);
  };
  // aplica a mutação e persiste; se salvar falhar, volta ao estado anterior
  function commit(mutate) {
    const snapshot = JSON.stringify(db);
    try {
      const out = mutate();
      save();
      return out;
    } catch (e) {
      db = JSON.parse(snapshot);
      throw e;
    }
  }

  let fails = 0;
  let lockedUntil = 0;
  const profileName = () => db.settings.profile_name ?? 'Minha Família';

  return {
    isFresh: () => fresh,

    // ----- perfil e PIN -----
    profile: () => ({ name: profileName() }),
    saveProfile: (name) => commit(() => { db.settings.profile_name = str(name, 'name', 40); return { ok: true }; }),
    hasPin: () => Boolean(db.settings.pin_hash),
    async verifyPin(pin) {
      if (Date.now() < lockedUntil) fail('Muitas tentativas. Aguarde alguns segundos.');
      const ok = db.settings.pin_hash && (await derive(String(pin ?? ''), db.settings.pin_salt)) === db.settings.pin_hash;
      if (!ok) {
        fails += 1;
        if (fails >= MAX_FAILS) { fails = 0; lockedUntil = Date.now() + LOCK_MS; }
        fail('PIN incorreto');
      }
      fails = 0;
    },
    async setPin(pin) {
      if (!/^\d{4,8}$/.test(String(pin ?? ''))) fail('O PIN deve ter de 4 a 8 dígitos');
      const salt = toHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
      const hash = await derive(String(pin), salt);
      commit(() => { db.settings.pin_salt = salt; db.settings.pin_hash = hash; });
    },
    removePin: () => commit(() => { delete db.settings.pin_salt; delete db.settings.pin_hash; }),

    // ----- categorias -----
    categories: (month) => listCategories(monthOf(month)),
    createCategory: (b) => commit(() => ({ id: insert('categories', categoryInput(b)).id })),
    updateCategory: (id, b) => commit(() => ({ id: update('categories', id, categoryInput(b)) })),
    deleteCategory: (id) => commit(() => {
      remove('categories', id);
      db.transactions.forEach((t) => { if (t.categoryId === id) t.categoryId = null; });
      return { ok: true };
    }),

    // ----- lançamentos -----
    transactions({ month, kind, status, q } = {}) {
      const [from, to] = range(monthOf(month));
      const needle = (q ?? '').trim().toLowerCase();
      return db.transactions
        .filter((t) => inRange(t, from, to) && (!kind || t.kind === kind) && (!status || t.status === status)
          && t.description.toLowerCase().includes(needle))
        .sort(byDateDesc).map(withCat);
    },
    createTransaction: (b) => commit(() => ({ id: insert('transactions', txInput(b)).id })),
    updateTransaction: (id, b) => commit(() => ({ id: update('transactions', id, txInput(b)) })),
    toggleTransaction: (id) => commit(() => {
      const t = db.transactions.find((x) => x.id === id) ?? fail('não encontrada');
      t.status = t.status === 'paid' ? 'pending' : 'paid';
      return { id, status: t.status };
    }),
    deleteTransaction: (id) => commit(() => { remove('transactions', id); return { ok: true }; }),

    // ----- resumos -----
    summary(monthArg) {
      const month = monthOf(monthArg);
      const [from, to] = range(month);
      const categories = listCategories(month).filter((c) => c.type === 'expense');
      const daily = new Map();
      for (const t of db.transactions) if (t.kind === 'expense' && inRange(t, from, to)) daily.set(t.date, (daily.get(t.date) ?? 0) + t.amountCents);
      return {
        month, incomeCents: sumKind('income', from, to), expenseCents: sumKind('expense', from, to),
        limitCents: categories.reduce((a, c) => a + c.limitCents, 0),
        spentCents: categories.reduce((a, c) => a + c.spentCents, 0), categories,
        daily: [...daily].sort().map(([date, c]) => ({ date, cents: c })),
      };
    },
    dashboard(monthArg) {
      const month = monthOf(monthArg);
      const [from, to] = range(month);
      const [pFrom] = range(prevMonth(month));
      const balanceCents = db.transactions.filter((t) => t.status === 'paid' && t.date < to)
        .reduce((a, t) => a + (t.kind === 'income' ? t.amountCents : -t.amountCents), 0);
      const pendingExpenses = db.transactions.filter((t) => t.kind === 'expense' && t.status === 'pending');
      return {
        month, today: today(), balanceCents,
        incomeCents: sumKind('income', from, to), expenseCents: sumKind('expense', from, to),
        prevIncomeCents: sumKind('income', pFrom, from), prevExpenseCents: sumKind('expense', pFrom, from),
        pendingCount: pendingExpenses.filter((t) => inRange(t, from, to)).length,
        categories: listCategories(month).filter((c) => c.type === 'expense'),
        upcoming: pendingExpenses.filter((t) => t.date < to)
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id)).slice(0, 6).map(withCat),
        recent: db.transactions.filter((t) => inRange(t, from, to)).sort(byDateDesc).slice(0, 6).map(withCat),
        flow: flowSeries(month, 6), goals: db.goals.map((g) => ({ ...g })),
      };
    },
    reports(monthArg, monthsArg) {
      const month = monthOf(monthArg);
      const n = Number(monthsArg) === 12 ? 12 : 6;
      const flow = flowSeries(month, n).map((f) => ({
        ...f, balanceCents: f.incomeCents - f.expenseCents,
        rate: f.incomeCents ? Math.round(((f.incomeCents - f.expenseCents) / f.incomeCents) * 100) : 0,
      }));
      const [from] = range(flow[0].month);
      const [, to] = range(month);
      const inPeriod = db.transactions.filter((t) => inRange(t, from, to));
      const spent = new Map();
      for (const t of inPeriod) if (t.kind === 'expense') spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amountCents);
      const distribution = [...spent].map(([id, spentCents]) => ({
        name: catOf(id)?.name ?? 'Sem categoria', color: catOf(id)?.color ?? 'gray', spentCents,
      })).sort((a, b) => b.spentCents - a.spentCents);
      return {
        month, months: n, flow, distribution, total: inPeriod.length,
        uncategorized: inPeriod.filter((t) => t.categoryId == null).length,
        pending: inPeriod.filter((t) => t.status === 'pending').length,
      };
    },

    // ----- metas -----
    goals: () => db.goals.map((g) => ({ ...g })),
    createGoal: (b) => commit(() => ({ id: insert('goals', goalInput(b)).id })),
    updateGoal: (id, b) => commit(() => ({ id: update('goals', id, goalInput(b)) })),
    depositGoal: (id, amountCents) => commit(() => {
      const g = db.goals.find((x) => x.id === id) ?? fail('não encontrada');
      if (!Number.isInteger(amountCents) || amountCents === 0) fail('amountCents inválido');
      if (g.savedCents + amountCents < 0) fail('Saldo da meta insuficiente');
      g.savedCents += amountCents;
      return { id, savedCents: g.savedCents };
    }),
    deleteGoal: (id) => commit(() => { remove('goals', id); return { ok: true }; }),

    // ----- dados -----
    importStatement: (csv, categoryId) => commit(() => {
      const cat = categoryId ? Number(categoryId) : null;
      if (cat && !catOf(cat)) fail('categoryId inexistente');
      const { rows, skipped } = parseStatement(csv ?? '', cat);
      if (!rows.length) fail('Nenhum lançamento válido encontrado no arquivo');
      rows.forEach((r) => insert('transactions', { ...r, status: 'paid' }));
      return { imported: rows.length, skipped };
    }),
    exportCsv(month) {
      if (month && !MONTH_RE.test(month)) fail('month inválido (use YYYY-MM)');
      const [from, to] = month ? range(month) : ['', '￿'];
      const rows = db.transactions.filter((t) => t.date >= from && t.date < to)
        .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));
      const lines = ['Data;Tipo;Descrição;Categoria;Valor;Situação'];
      for (const t of rows) {
        lines.push([t.date, t.kind === 'income' ? 'Receita' : 'Despesa', csvCell(t.description), csvCell(catOf(t.categoryId)?.name ?? ''),
          ((t.kind === 'income' ? 1 : -1) * t.amountCents / 100).toFixed(2).replace('.', ','),
          t.status === 'paid' ? 'Concluído' : 'Pendente'].join(';'));
      }
      return `﻿${lines.join('\r\n')}\r\n`;
    },
    // apaga lançamentos e metas (mantém categorias, perfil e PIN): útil para sair dos dados de exemplo
    clearData: () => commit(() => {
      db.transactions = [];
      db.goals = [];
      db.seq.transactions = 0;
      db.seq.goals = 0;
      return { ok: true };
    }),
    backup: () => ({
      app: 'finhub', version: 1, exportedAt: new Date().toISOString(), profile: { name: profileName() },
      categories: db.categories.map((c) => ({ ...c })), transactions: db.transactions.map((t) => ({ ...t })),
      goals: db.goals.map((g) => ({ ...g })),
    }),
    restore: (d) => commit(() => {
      if (!d || d.app !== 'finhub' || !Array.isArray(d.categories) || !Array.isArray(d.transactions) || !Array.isArray(d.goals)) {
        fail('Arquivo de backup inválido');
      }
      const next = { ...emptyDb(), settings: { ...db.settings } };
      const ids = new Set();
      for (const c of d.categories) {
        const id = cents(c.id, 'id');
        next.categories.push({ id, ...categoryInput(c) });
        ids.add(id);
        next.seq.categories = Math.max(next.seq.categories, id);
      }
      for (const t of d.transactions) {
        const row = {
          kind: oneOf(t.kind, ['expense', 'income'], 'kind'), categoryId: ids.has(t.categoryId) ? t.categoryId : null,
          description: str(t.description, 'description', 120), amountCents: cents(t.amountCents, 'amountCents'),
          date: dateStr(t.date), status: oneOf(t.status ?? 'paid', ['paid', 'pending'], 'status'),
        };
        next.seq.transactions += 1;
        next.transactions.push({ id: next.seq.transactions, ...row });
      }
      for (const g of d.goals) {
        next.seq.goals += 1;
        next.goals.push({ id: next.seq.goals, ...goalInput(g) });
      }
      if (d.profile?.name) next.settings.profile_name = str(d.profile.name, 'name', 40);
      db = next;
      return { ok: true, transactions: next.transactions.length };
    }),
  };
}
