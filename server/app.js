import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const currentMonth = () => new Date().toISOString().slice(0, 7);
const monthOf = (q) => {
  const m = q.get('month') || currentMonth();
  if (!MONTH_RE.test(m)) throw new HttpError(400, 'month inválido (use YYYY-MM)');
  return m;
};
const nextMonth = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
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

export function buildApi(db) {
  const spentByCategory = `
    SELECT category_id, COALESCE(SUM(amount_cents),0) spent FROM transactions
    WHERE kind='expense' AND date >= ? AND date < ? GROUP BY category_id`;

  function listCategories(month) {
    const from = `${month}-01`, to = `${nextMonth(month)}-01`;
    const spent = new Map(db.prepare(spentByCategory).all(from, to).map((r) => [r.category_id, r.spent]));
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
    if (!DATE_RE.test(b.date ?? '')) throw new HttpError(400, 'date inválida');
    let categoryId = null;
    if (b.categoryId != null) {
      categoryId = Number(b.categoryId);
      if (!db.prepare('SELECT 1 FROM categories WHERE id=?').get(categoryId)) throw new HttpError(400, 'categoryId inexistente');
    }
    return [kind, categoryId, str(b.description, 'description', 120), cents(b.amountCents, 'amountCents'), b.date];
  }

  const routes = [
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
    ['GET', /^\/api\/transactions$/, (q) => {
      const month = monthOf(q);
      const kind = q.get('kind');
      const search = `%${(q.get('q') || '').trim()}%`;
      return db.prepare(`
        SELECT t.id, t.kind, t.category_id categoryId, c.name categoryName, c.color categoryColor,
               t.description, t.amount_cents amountCents, t.date
        FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.date >= ? AND t.date < ? AND (? IS NULL OR t.kind = ?) AND t.description LIKE ?
        ORDER BY t.date DESC, t.id DESC`)
        .all(`${month}-01`, `${nextMonth(month)}-01`, kind, kind, search);
    }],
    ['POST', /^\/api\/transactions$/, (q, body) => {
      const r = db.prepare('INSERT INTO transactions (kind,category_id,description,amount_cents,date) VALUES (?,?,?,?,?)').run(...txInput(body));
      return [201, { id: Number(r.lastInsertRowid) }];
    }],
    ['PUT', /^\/api\/transactions\/(\d+)$/, (q, body, id) => {
      const r = db.prepare('UPDATE transactions SET kind=?,category_id=?,description=?,amount_cents=?,date=? WHERE id=?').run(...txInput(body), id);
      if (!r.changes) throw new HttpError(404, 'não encontrada');
      return { id };
    }],
    ['DELETE', /^\/api\/transactions\/(\d+)$/, (q, b, id) => {
      if (!db.prepare('DELETE FROM transactions WHERE id=?').run(id).changes) throw new HttpError(404, 'não encontrada');
      return { ok: true };
    }],
    ['GET', /^\/api\/summary$/, (q) => {
      const month = monthOf(q);
      const from = `${month}-01`, to = `${nextMonth(month)}-01`;
      const sum = (kind) => db.prepare('SELECT COALESCE(SUM(amount_cents),0) s FROM transactions WHERE kind=? AND date>=? AND date<?').get(kind, from, to).s;
      const categories = listCategories(month).filter((c) => c.type === 'expense');
      const limitCents = categories.reduce((a, c) => a + c.limitCents, 0);
      const spentCents = categories.reduce((a, c) => a + c.spentCents, 0);
      const daily = db.prepare(`SELECT date, SUM(amount_cents) cents FROM transactions
        WHERE kind='expense' AND date>=? AND date<? GROUP BY date ORDER BY date`).all(from, to);
      return { month, incomeCents: sum('income'), expenseCents: sum('expense'), limitCents, spentCents, categories, daily };
    }],
  ];

  return async function handle(req, url, readBody) {
    for (const [method, re, fn] of routes) {
      const m = url.pathname.match(re);
      if (m && method === req.method) {
        const body = method === 'POST' || method === 'PUT' ? await readBody() : null;
        const out = fn(url.searchParams, body, m[1] && Number(m[1]));
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
    req.on('data', (c) => { data += c; if (data.length > 1e5) { reject(new HttpError(413, 'corpo grande demais')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new HttpError(400, 'JSON inválido')); } });
  });

  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        const [status, payload] = await api(req, url, () => readBody(req));
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(payload));
      }
      const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname);
      if (rel.includes('..')) throw new HttpError(403, 'proibido');
      const file = await readFile(join(PUBLIC_DIR, rel)).catch(() => { throw new HttpError(404, 'não encontrado'); });
      res.writeHead(200, { 'Content-Type': MIME[extname(rel)] ?? 'application/octet-stream' });
      res.end(file);
    } catch (e) {
      const status = e.status ?? 500;
      if (status === 500) console.error(e);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: status === 500 ? 'erro interno' : e.message }));
    }
  });
}
