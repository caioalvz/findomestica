import { createStore, memoryStorage } from './store.js';

// Todos os dados ficam no navegador (localStorage). Se ele estiver bloqueado
// (aba privada, política do navegador), o app segue funcionando só em memória.
function pickStorage() {
  try {
    const s = window.localStorage;
    s.setItem('finhub:probe', '1');
    s.removeItem('finhub:probe');
    return { storage: s, persistent: true };
  } catch {
    return { storage: memoryStorage(), persistent: false };
  }
}
const { storage, persistent } = pickStorage();
const store = createStore(storage);
export const storageIsPersistent = persistent;

// "Sessão" = estado de desbloqueio da aba atual. É só um bloqueio de tela.
const UNLOCK_KEY = 'finhub:unlocked';
export const session = {
  get: () => sessionStorage.getItem(UNLOCK_KEY),
  set: (v) => (v ? sessionStorage.setItem(UNLOCK_KEY, '1') : sessionStorage.removeItem(UNLOCK_KEY)),
};
const isLocked = () => store.hasPin() && !session.get();

function guard() {
  if (isLocked()) {
    window.dispatchEvent(new Event('finhub:locked'));
    throw new Error('Sessão bloqueada');
  }
}
// envolve uma função do store: checa o bloqueio e devolve uma Promise
const guarded = (fn) => async (...args) => { guard(); return fn(...args); };

function saveFile(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
export const downloadJson = (data, filename) => saveFile(JSON.stringify(data, null, 2), 'application/json', filename);

export const api = {
  authStatus: async () => ({
    hasPin: store.hasPin(), unlocked: !isLocked(), name: store.profile().name,
  }),
  login: async (pin) => {
    if (store.hasPin()) await store.verifyPin(pin);
    return { token: '1' };
  },
  logout: async () => ({ ok: true }),
  setPin: async (pin, current) => {
    if (store.hasPin()) { guard(); await store.verifyPin(current); }
    await store.setPin(pin);
    return { token: '1' };
  },
  removePin: async (current) => {
    guard();
    if (store.hasPin()) await store.verifyPin(current);
    store.removePin();
    return { ok: true };
  },
  profile: guarded(() => store.profile()),
  saveProfile: guarded((name) => store.saveProfile(name)),

  summary: guarded((month) => store.summary(month)),
  dashboard: guarded((month) => store.dashboard(month)),
  reports: guarded((month, months) => store.reports(month, months)),

  categories: guarded((month) => store.categories(month)),
  saveCategory: guarded((c) => (c.id ? store.updateCategory(c.id, c) : store.createCategory(c))),
  deleteCategory: guarded((id) => store.deleteCategory(Number(id))),

  transactions: guarded((params) => store.transactions(params)),
  saveTransaction: guarded((t) => (t.id ? store.updateTransaction(t.id, t) : store.createTransaction(t))),
  toggleTransaction: guarded((id) => store.toggleTransaction(Number(id))),
  deleteTransaction: guarded((id) => store.deleteTransaction(Number(id))),

  goals: guarded(() => store.goals()),
  saveGoal: guarded((g) => (g.id ? store.updateGoal(g.id, g) : store.createGoal(g))),
  depositGoal: guarded((id, amountCents) => store.depositGoal(Number(id), amountCents)),
  deleteGoal: guarded((id) => store.deleteGoal(Number(id))),

  importStatement: guarded((csv, categoryId) => store.importStatement(csv, categoryId)),
  backup: guarded(() => store.backup()),
  restore: guarded((data) => store.restore(data)),
  clearData: guarded(() => store.clearData()),
  downloadCsv: guarded((month) => saveFile(store.exportCsv(month), 'text/csv;charset=utf-8', `finhub-${month || 'completo'}.csv`)),
};
