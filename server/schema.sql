CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('expense','income')) DEFAULT 'expense',
  icon TEXT NOT NULL DEFAULT 'star',
  color TEXT NOT NULL DEFAULT 'indigo',
  monthly_limit_cents INTEGER NOT NULL DEFAULT 0 CHECK (monthly_limit_cents >= 0)
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('expense','income')),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
