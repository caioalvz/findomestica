const TOKEN_KEY = 'finhub_token';
export const session = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t) => (t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY)),
};

function headers(body) {
  const h = {};
  if (body) h['Content-Type'] = 'application/json';
  const t = session.get();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function request(method, path, body) {
  const res = await fetch(path, { method, headers: headers(body), body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    window.dispatchEvent(new Event('finhub:locked'));
    throw new Error('Sessão bloqueada');
  }
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
}

const qs = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();

async function download(path, filename) {
  const res = await fetch(path, { headers: headers() });
  if (!res.ok) throw new Error('Falha ao gerar o arquivo');
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  authStatus: () => request('GET', '/api/auth/status'),
  login: (pin) => request('POST', '/api/auth/login', { pin }),
  logout: () => request('POST', '/api/auth/logout', {}),
  setPin: (pin, current) => request('POST', '/api/auth/pin', { pin, current }),
  removePin: (current) => request('POST', '/api/auth/pin/remove', { current }),
  profile: () => request('GET', '/api/profile'),
  saveProfile: (name) => request('PUT', '/api/profile', { name }),

  summary: (month) => request('GET', `/api/summary?${qs({ month })}`),
  dashboard: (month) => request('GET', `/api/dashboard?${qs({ month })}`),
  reports: (month, months) => request('GET', `/api/reports?${qs({ month, months })}`),

  categories: (month) => request('GET', `/api/categories?${qs({ month })}`),
  saveCategory: (c) => (c.id ? request('PUT', `/api/categories/${c.id}`, c) : request('POST', '/api/categories', c)),
  deleteCategory: (id) => request('DELETE', `/api/categories/${id}`),

  transactions: (params) => request('GET', `/api/transactions?${qs(params)}`),
  saveTransaction: (t) => (t.id ? request('PUT', `/api/transactions/${t.id}`, t) : request('POST', '/api/transactions', t)),
  toggleTransaction: (id) => request('POST', `/api/transactions/${id}/toggle`, {}),
  deleteTransaction: (id) => request('DELETE', `/api/transactions/${id}`),

  goals: () => request('GET', '/api/goals'),
  saveGoal: (g) => (g.id ? request('PUT', `/api/goals/${g.id}`, g) : request('POST', '/api/goals', g)),
  depositGoal: (id, amountCents) => request('POST', `/api/goals/${id}/deposit`, { amountCents }),
  deleteGoal: (id) => request('DELETE', `/api/goals/${id}`),

  importStatement: (csv, categoryId) => request('POST', '/api/import', { csv, categoryId }),
  backup: () => request('GET', '/api/backup'),
  restore: (data) => request('POST', '/api/restore', { data }),
  downloadCsv: (month) => download(`/api/export?${qs({ month })}`, `finhub-${month || 'completo'}.csv`),
};
