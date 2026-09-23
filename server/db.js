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

const SEED_TX = [
  ['expense', 1, 'Aluguel', 80000, 1], ['expense', 1, 'Energia elétrica', 15000, 8],
  ['expense', 1, 'Internet', 6000, 10], ['expense', 1, 'Condomínio', 10600, 5],
  ['expense', 2, 'Supermercado', 48000, 4], ['expense', 2, 'Feira', 13200, 12],
  ['expense', 3, 'Farmácia', 15000, 9], ['expense', 3, 'Consulta', 15000, 14],
  ['expense', 4, 'Combustível', 26000, 6], ['expense', 4, 'Aplicativo de transporte', 8000, 15],
  ['expense', 5, 'Curso de inglês', 45000, 7], ['expense', 6, 'Cinema e jantar', 14990, 13],
  ['income', 7, 'Salário', 420000, 5],
];

export function openDb(path = ':memory:', { seed = false } = {}) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(schema);
  if (seed && db.prepare('SELECT COUNT(*) n FROM categories').get().n === 0) {
    const month = new Date().toISOString().slice(0, 7);
    const insCat = db.prepare('INSERT INTO categories (name,subtitle,type,icon,color,monthly_limit_cents) VALUES (?,?,?,?,?,?)');
    for (const c of SEED_CATEGORIES) insCat.run(...c);
    const insTx = db.prepare('INSERT INTO transactions (kind,category_id,description,amount_cents,date) VALUES (?,?,?,?,?)');
    for (const [k, c, d, a, day] of SEED_TX) insTx.run(k, c, d, a, `${month}-${String(day).padStart(2, '0')}`);
  }
  return db;
}
