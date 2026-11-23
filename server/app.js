import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError } from './errors.js';
import { createAuth, createSettings } from './auth.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BODY_LIMIT = 5e6;

const pad = (n) => String(n).padStart(2, '0');
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const currentMonth = () => localToday().slice(0, 7);
const monthOf = (q) => {
  const m = q.get('month') || currentMonth();
  if (!MONTH_RE.test(m)) throw new HttpError(400, 'month inválido (use YYYY-MM)');
  return m;
};
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
  if (!s || s.length > max) throw new HttpError(400, `${field} inválido`);
  return s;
};
const cents = (v, field, { allowZero = false } = {}) => {
  if (!Number.isInteger(v) || v < 0 || (!allowZero && v === 0)) throw new HttpError(400, `${field} inválido`);
  return v;
};
const oneOf = (v, list, field) => {
  if (!list.includes(v)) throw new HttpError(400, `${field} inválido`);
  return v;
};
const dateStr = (v, field = 'date') => {
  if (!DATE_RE.test(v ?? '') || Number.isNaN(Date.parse(v))) throw new HttpError(400, `${field} inválida`);
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

export function buildApi(db) {
  const settings = createSettings(db);
  const auth = createAuth(settings);

  const sumKind = (kind, from, to) => db.prepare(
    'SELECT COALESCE(SUM(amount_cents),0) s FROM transactions WHERE kind=? AND date>=? AND date<?',
  ).get(kind, from, to).s;

  function listCategories(month) {
    const from = `${month}-01`, to = `${nextMonth(month)}-01`;
    const spent = new Map(db.prepare(`
      SELECT category_id, COALESCE(SUM(amount_cents),0) spent FROM transactions
      WHERE kind='expense' AND date >= ? AND date < ? GROUP BY category_id`).all(from, to).map((r) => [r.category_id, r.spent]));
    return db.prepare('SELECT * FROM categories ORDER BY id').all().map((c) => ({
      id: c.id, name: c.name, subtitle: c.subtitle, type: c.type, icon: c.icon, color: c.color,
      limitCents: c.monthly_limit_cents, spentCents: spent.get(c.id) ?? 0,
    }));
  }

  function categoryInput(b) {
    return [
      str(b.name, 'name'), typeof b.subtitle === 'string' ? b.subtitle.trim().slice(0, 60) : '',
      oneOf(b.type ?? 'expense', ['expense', 'income'], 'type'),
      str(b.icon ?? 'star', 'icon', 20), str(b.color ?? 'indigo', 'color', 20),
      cents(b.limitCents ?? 0, 'limitCents', { allowZero: true }),
    ];
  }

  function txInput(b) {
    const kind = oneOf(b.kind, ['expense', 'income'], 'kind');
    let categoryId = null;
    if (b.categoryId != null) {
      categoryId = Number(b.categoryId);
      if (!db.prepare('SELECT 1 FROM categories WHERE id=?').get(categoryId)) throw new HttpError(400, 'categoryId inexistente');
    }
    return [
      kind, categoryId, str(b.description, 'description', 120), cents(b.amountCents, 'amountCents'),
      dateStr(b.date), oneOf(b.status ?? 'paid', ['paid', 'pending'], 'status'),
    ];
  }

  function goalRow(g) {
    return { id: g.id, name: g.name, targetCents: g.target_cents, savedCents: g.saved_cents, deadline: g.deadline, color: g.color };
  }
  function goalInput(b) {
    return [
      str(b.name, 'name'), cents(b.targetCents, 'targetCents'), cents(b.savedCents ?? 0, 'savedCents', { allowZero: true }),
      b.deadline ? dateStr(b.deadline, 'deadline') : null, str(b.color ?? 'indigo', 'color', 20),
    ];
  }

  function flowSeries(month, n) {
    const months = monthsBack(month, n);
    const rows = db.prepare(`
      SELECT substr(date,1,7) m, kind, SUM(amount_cents) s FROM transactions
      WHERE date >= ? AND date < ? GROUP BY m, kind`).all(`${months[0]}-01`, `${nextMonth(month)}-01`);
    const pick = (m, kind) => rows.find((r) => r.m === m && r.kind === kind)?.s ?? 0;
    return months.map((m) => ({ month: m, incomeCents: pick(m, 'income'), expenseCents: pick(m, 'expense') }));
  }

  function inTransaction(fn) {
    db.exec('BEGIN');
    try { const out = fn(); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
  }

  const tokenOf = (req) => (req.headers.authorization ?? '').replace(/^Bearer /, '');
  const requireSession = (req) => {
    if (auth.hasPin() && !auth.valid(tokenOf(req))) throw new HttpError(401, 'bloqueado');
  };

  const routes = [
    // ---- auth / perfil ----
    ['GET', /^\/api\/auth\/status$/, (q, b, id, req) => ({
      hasPin: auth.hasPin(), unlocked: !auth.hasPin() || auth.valid(tokenOf(req)), name: settings.get('profile_name') ?? 'Minha Família',
    })],
    ['POST', /^\/api\/auth\/login$/, (q, body) => {
      if (auth.hasPin()) auth.verify(body.pin);
      return { token: auth.issue() };
    }],
    ['POST', /^\/api\/auth\/logout$/, (q, b, id, req) => { auth.revoke(tokenOf(req)); return { ok: true }; }],
    ['POST', /^\/api\/auth\/pin$/, (q, body, id, req) => {
      if (auth.hasPin()) { requireSession(req); auth.verify(body.current); }
      auth.setPin(body.pin);
      return { token: auth.issue() };
    }],
    ['POST', /^\/api\/auth\/pin\/remove$/, (q, body, id, req) => {
      requireSession(req);
      if (auth.hasPin()) auth.verify(body.current);
      auth.removePin();
      return { ok: true };
    }],
    ['GET', /^\/api\/profile$/, () => ({ name: settings.get('profile_name') ?? 'Minha Família' })],
    ['PUT', /^\/api\/profile$/, (q, body) => {
      settings.set('profile_name', str(body.name, 'name', 40));
      return { ok: true };
    }],

    // ---- categorias ----
    ['GET', /^\/api\/categories$/, (q) => listCategories(monthOf(q))],
    ['POST', /^\/api\/categories$/, (q, body) => {
      const r = db.prepare('INSERT INTO categories (name,subtitle,type,icon,color,monthly_limit_cents) VALUES (?,?,?,?,?,?)').run(...categoryInput(body));
      return [201, { id: Number(r.lastInsertRowid) }];
    }],
    ['PUT', /^\/api\/categories\/(\d+)$/, (q, body, id) => {
      const r = db.prepare('UPDATE categories SET name=?,subtitle=?,type=?,icon=?,color=?,monthly_limit_cents=? WHERE id=?').run(...categoryInput(body), id);
      if (!r.changes) throw new HttpError(404, 'não encontrada');
      return { id };
    }],
    ['DELETE', /^\/api\/categories\/(\d+)$/, (q, b, id) => {
      if (!db.prepare('DELETE FROM categories WHERE id=?').run(id).changes) throw new HttpError(404, 'não encontrada');
      return { ok: true };
    }],

    // ---- lançamentos ----
    ['GET', /^\/api\/transactions$/, (q) => {
      const month = monthOf(q);
      const kind = q.get('kind') || null;
      const status = q.get('status') || null;
      const search = `%${(q.get('q') || '').trim()}%`;
      return db.prepare(`
        SELECT t.id, t.kind, t.category_id categoryId, c.name categoryName, c.color categoryColor,
               t.description, t.amount_cents amountCents, t.date, t.status
        FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.date >= ? AND t.date < ? AND (? IS NULL OR t.kind = ?) AND (? IS NULL OR t.status = ?)
          AND t.description LIKE ?
        ORDER BY t.date DESC, t.id DESC`)
        .all(`${month}-01`, `${nextMonth(month)}-01`, kind, kind, status, status, search);
    }],
    ['POST', /^\/api\/transactions$/, (q, body) => {
      const r = db.prepare('INSERT INTO transactions (kind,category_id,description,amount_cents,date,status) VALUES (?,?,?,?,?,?)').run(...txInput(body));
      return [201, { id: Number(r.lastInsertRowid) }];
    }],
    ['PUT', /^\/api\/transactions\/(\d+)$/, (q, body, id) => {
      const r = db.prepare('UPDATE transactions SET kind=?,category_id=?,description=?,amount_cents=?,date=?,status=? WHERE id=?').run(...txInput(body), id);
      if (!r.changes) throw new HttpError(404, 'não encontrada');
      return { id };
    }],
    ['POST', /^\/api\/transactions\/(\d+)\/toggle$/, (q, b, id) => {
      const r = db.prepare("UPDATE transactions SET status = CASE status WHEN 'paid' THEN 'pending' ELSE 'paid' END WHERE id=?").run(id);
      if (!r.changes) throw new HttpError(404, 'não encontrada');
      return db.prepare('SELECT id, status FROM transactions WHERE id=?').get(id);
    }],
    ['DELETE', /^\/api\/transactions\/(\d+)$/, (q, b, id) => {
      if (!db.prepare('DELETE FROM transactions WHERE id=?').run(id).changes) throw new HttpError(404, 'não encontrada');
      return { ok: true };
    }],

    // ---- resumos ----
    ['GET', /^\/api\/summary$/, (q) => {
      const month = monthOf(q);
      const from = `${month}-01`, to = `${nextMonth(month)}-01`;
      const categories = listCategories(month).filter((c) => c.type === 'expense');
      const limitCents = categories.reduce((a, c) => a + c.limitCents, 0);
      const spentCents = categories.reduce((a, c) => a + c.spentCents, 0);
      const daily = db.prepare(`SELECT date, SUM(amount_cents) cents FROM transactions
        WHERE kind='expense' AND date>=? AND date<? GROUP BY date ORDER BY date`).all(from, to);
      return {
        month, incomeCents: sumKind('income', from, to), expenseCents: sumKind('expense', from, to),
        limitCents, spentCents, categories, daily,
      };
    }],
    ['GET', /^\/api\/dashboard$/, (q) => {
      const month = monthOf(q);
      const from = `${month}-01`, to = `${nextMonth(month)}-01`;
      const prev = prevMonth(month);
      const categories = listCategories(month).filter((c) => c.type === 'expense');
      const balanceCents = db.prepare(`
        SELECT COALESCE(SUM(CASE kind WHEN 'income' THEN amount_cents ELSE -amount_cents END),0) s
        FROM transactions WHERE status='paid' AND date < ?`).get(to).s;
      const upcoming = db.prepare(`
        SELECT t.id, t.description, t.amount_cents amountCents, t.date, c.name categoryName, c.color categoryColor
        FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.kind='expense' AND t.status='pending' AND t.date < ? ORDER BY t.date LIMIT 6`).all(to);
      const recent = db.prepare(`
        SELECT t.id, t.kind, t.description, t.amount_cents amountCents, t.date, t.status,
               c.name categoryName, c.color categoryColor
        FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.date >= ? AND t.date < ? ORDER BY t.date DESC, t.id DESC LIMIT 6`).all(from, to);
      return {
        month, today: localToday(), balanceCents,
        incomeCents: sumKind('income', from, to), expenseCents: sumKind('expense', from, to),
        prevIncomeCents: sumKind('income', `${prev}-01`, from), prevExpenseCents: sumKind('expense', `${prev}-01`, from),
        pendingCount: db.prepare("SELECT COUNT(*) n FROM transactions WHERE kind='expense' AND status='pending' AND date>=? AND date<?").get(from, to).n,
        categories, upcoming, recent, flow: flowSeries(month, 6),
        goals: db.prepare('SELECT * FROM goals ORDER BY id').all().map(goalRow),
      };
    }],
    ['GET', /^\/api\/reports$/, (q) => {
      const month = monthOf(q);
      const n = Number(q.get('months')) === 12 ? 12 : 6;
      const flow = flowSeries(month, n).map((f) => ({
        ...f, balanceCents: f.incomeCents - f.expenseCents,
        rate: f.incomeCents ? Math.round(((f.incomeCents - f.expenseCents) / f.incomeCents) * 100) : 0,
      }));
      const from = `${flow[0].month}-01`, to = `${nextMonth(month)}-01`;
      const distribution = db.prepare(`
        SELECT c.name, c.color, SUM(t.amount_cents) spentCents FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.kind='expense' AND t.date>=? AND t.date<? GROUP BY t.category_id ORDER BY spentCents DESC`).all(from, to)
        .map((r) => ({ name: r.name ?? 'Sem categoria', color: r.color ?? 'gray', spentCents: r.spentCents }));
      const counts = db.prepare(`
        SELECT COUNT(*) total, SUM(category_id IS NULL) uncategorized, SUM(status='pending') pending
        FROM transactions WHERE date>=? AND date<?`).get(from, to);
      return {
        month, months: n, flow, distribution,
        total: counts.total, uncategorized: counts.uncategorized ?? 0, pending: counts.pending ?? 0,
      };
    }],

    // ---- metas ----
    ['GET', /^\/api\/goals$/, () => db.prepare('SELECT * FROM goals ORDER BY id').all().map(goalRow)],
    ['POST', /^\/api\/goals$/, (q, body) => {
      const r = db.prepare('INSERT INTO goals (name,target_cents,saved_cents,deadline,color) VALUES (?,?,?,?,?)').run(...goalInput(body));
      return [201, { id: Number(r.lastInsertRowid) }];
    }],
    ['PUT', /^\/api\/goals\/(\d+)$/, (q, body, id) => {
      const r = db.prepare('UPDATE goals SET name=?,target_cents=?,saved_cents=?,deadline=?,color=? WHERE id=?').run(...goalInput(body), id);
      if (!r.changes) throw new HttpError(404, 'não encontrada');
      return { id };
    }],
    ['POST', /^\/api\/goals\/(\d+)\/deposit$/, (q, body, id) => {
      const g = db.prepare('SELECT saved_cents FROM goals WHERE id=?').get(id);
      if (!g) throw new HttpError(404, 'não encontrada');
      if (!Number.isInteger(body.amountCents) || body.amountCents === 0) throw new HttpError(400, 'amountCents inválido');
      const saved = g.saved_cents + body.amountCents;
      if (saved < 0) throw new HttpError(400, 'Saldo da meta insuficiente');
      db.prepare('UPDATE goals SET saved_cents=? WHERE id=?').run(saved, id);
      return { id, savedCents: saved };
    }],
    ['DELETE', /^\/api\/goals\/(\d+)$/, (q, b, id) => {
      if (!db.prepare('DELETE FROM goals WHERE id=?').run(id).changes) throw new HttpError(404, 'não encontrada');
      return { ok: true };
    }],

    // ---- dados: importar, exportar, backup ----
    ['POST', /^\/api\/import$/, (q, body) => {
      const categoryId = body.categoryId ? Number(body.categoryId) : null;
      if (categoryId && !db.prepare('SELECT 1 FROM categories WHERE id=?').get(categoryId)) throw new HttpError(400, 'categoryId inexistente');
      const { rows, skipped } = parseStatement(body.csv ?? '', categoryId);
      if (!rows.length) throw new HttpError(400, 'Nenhum lançamento válido encontrado no arquivo');
      const ins = db.prepare("INSERT INTO transactions (kind,category_id,description,amount_cents,date,status) VALUES (?,?,?,?,?,'paid')");
      inTransaction(() => rows.forEach((r) => ins.run(r.kind, r.categoryId, r.description, r.amountCents, r.date)));
      return { imported: rows.length, skipped };
    }],
    ['GET', /^\/api\/export$/, (q) => {
      const month = q.get('month');
      if (month && !MONTH_RE.test(month)) throw new HttpError(400, 'month inválido (use YYYY-MM)');
      const rows = db.prepare(`
        SELECT t.date, t.kind, t.description, c.name category, t.amount_cents, t.status
        FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
        WHERE (? IS NULL OR (t.date >= ? AND t.date < ?)) ORDER BY t.date, t.id`)
        .all(month, `${month}-01`, month ? `${nextMonth(month)}-01` : '');
      const lines = ['Data;Tipo;Descrição;Categoria;Valor;Situação'];
      for (const r of rows) {
        lines.push([r.date, r.kind === 'income' ? 'Receita' : 'Despesa', csvCell(r.description), csvCell(r.category ?? ''),
          ((r.kind === 'income' ? 1 : -1) * r.amount_cents / 100).toFixed(2).replace('.', ','),
          r.status === 'paid' ? 'Concluído' : 'Pendente'].join(';'));
      }
      return { raw: true, type: 'text/csv; charset=utf-8', body: `﻿${lines.join('\r\n')}\r\n` };
    }],
    ['GET', /^\/api\/backup$/, () => ({
      app: 'finhub', version: 1, exportedAt: new Date().toISOString(),
      profile: { name: settings.get('profile_name') ?? 'Minha Família' },
      categories: listCategories('1970-01').map(({ spentCents, ...c }) => c),
      transactions: db.prepare(`SELECT id, kind, category_id categoryId, description, amount_cents amountCents, date, status
        FROM transactions ORDER BY id`).all(),
      goals: db.prepare('SELECT * FROM goals ORDER BY id').all().map(goalRow),
    })],
    ['POST', /^\/api\/restore$/, (q, body) => {
      const d = body.data;
      if (!d || d.app !== 'finhub' || !Array.isArray(d.categories) || !Array.isArray(d.transactions) || !Array.isArray(d.goals)) {
        throw new HttpError(400, 'Arquivo de backup inválido');
      }
      inTransaction(() => {
        db.exec('DELETE FROM transactions; DELETE FROM categories; DELETE FROM goals;');
        const ids = new Set();
        const insCat = db.prepare('INSERT INTO categories (id,name,subtitle,type,icon,color,monthly_limit_cents) VALUES (?,?,?,?,?,?,?)');
        for (const c of d.categories) {
          const [name, subtitle, type, icon, color, limit] = categoryInput(c);
          insCat.run(cents(c.id, 'id'), name, subtitle, type, icon, color, limit);
          ids.add(c.id);
        }
        const insTx = db.prepare('INSERT INTO transactions (kind,category_id,description,amount_cents,date,status) VALUES (?,?,?,?,?,?)');
        for (const t of d.transactions) {
          const [kind, , description, amount, date, status] = [
            oneOf(t.kind, ['expense', 'income'], 'kind'), null, str(t.description, 'description', 120),
            cents(t.amountCents, 'amountCents'), dateStr(t.date), oneOf(t.status ?? 'paid', ['paid', 'pending'], 'status'),
          ];
          insTx.run(kind, ids.has(t.categoryId) ? t.categoryId : null, description, amount, date, status);
        }
        const insGoal = db.prepare('INSERT INTO goals (name,target_cents,saved_cents,deadline,color) VALUES (?,?,?,?,?)');
        for (const g of d.goals) insGoal.run(...goalInput(g));
        if (d.profile?.name) settings.set('profile_name', str(d.profile.name, 'name', 40));
      });
      return { ok: true, transactions: d.transactions.length };
    }],
  ];

  return async function handle(req, url, readBody) {
    if (!url.pathname.startsWith('/api/auth/')) requireSession(req);
    for (const [method, re, fn] of routes) {
      const m = url.pathname.match(re);
      if (m && method === req.method) {
        const body = method === 'POST' || method === 'PUT' ? await readBody() : null;
        const out = fn(url.searchParams, body, m[1] && Number(m[1]), req);
        return Array.isArray(out) && typeof out[0] === 'number' ? out : [200, out];
      }
    }
    throw new HttpError(404, 'rota não encontrada');
  };
}

export function createApp(db) {
  const api = buildApi(db);
  const readBody = (req) => new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > BODY_LIMIT) { reject(new HttpError(413, 'corpo grande demais')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new HttpError(400, 'JSON inválido')); } });
  });

  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        const [status, payload] = await api(req, url, () => readBody(req));
        if (payload?.raw) {
          res.writeHead(status, { 'Content-Type': payload.type });
          return res.end(payload.body);
        }
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(payload));
      }
      const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname);
      if (rel.includes('..')) throw new HttpError(403, 'proibido');
      const file = await readFile(join(PUBLIC_DIR, rel)).catch(() => { throw new HttpError(404, 'não encontrado'); });
      res.writeHead(200, { 'Content-Type': MIME[extname(rel)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(file);
    } catch (e) {
      const status = e.status ?? 500;
      if (status === 500) console.error(e);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: status === 500 ? 'erro interno' : e.message }));
    }
  });
}
