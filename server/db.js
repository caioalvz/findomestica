import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

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

const pad = (n) => String(n).padStart(2, '0');

function migrate(db) {
  const cols = db.prepare('PRAGMA table_info(transactions)').all().map((c) => c.name);
  if (!cols.includes('status')) {
    db.exec("ALTER TABLE transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'paid'");
  }
}

function seedHistory(db, now) {
  const ins = db.prepare('INSERT INTO transactions (kind,category_id,description,amount_cents,date,status) VALUES (?,?,?,?,?,?)');
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
    for (const [k, c, desc, amount, day] of rows) ins.run(k, c, desc, amount, `${m}-${pad(day)}`, 'paid');
  }
}

export function openDb(path = ':memory:', { seed = false } = {}) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(schema);
  migrate(db);
  if (seed && db.prepare('SELECT COUNT(*) n FROM categories').get().n === 0) {
    const now = new Date();
    const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const insCat = db.prepare('INSERT INTO categories (name,subtitle,type,icon,color,monthly_limit_cents) VALUES (?,?,?,?,?,?)');
    for (const c of SEED_CATEGORIES) insCat.run(...c);
    const insTx = db.prepare('INSERT INTO transactions (kind,category_id,description,amount_cents,date,status) VALUES (?,?,?,?,?,?)');
    for (const [k, c, d, a, day, status] of SEED_TX) insTx.run(k, c, d, a, `${month}-${pad(day)}`, status ?? 'paid');
    seedHistory(db, now);
    const insGoal = db.prepare('INSERT INTO goals (name,target_cents,saved_cents,deadline,color) VALUES (?,?,?,?,?)');
    for (const g of SEED_GOALS) insGoal.run(...g);
  }
  return db;
}
