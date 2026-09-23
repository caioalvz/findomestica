async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
}

const qs = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();

export const api = {
  summary: (month) => request('GET', `/api/summary?${qs({ month })}`),
  categories: (month) => request('GET', `/api/categories?${qs({ month })}`),
  saveCategory: (c) => (c.id ? request('PUT', `/api/categories/${c.id}`, c) : request('POST', '/api/categories', c)),
  deleteCategory: (id) => request('DELETE', `/api/categories/${id}`),
  transactions: (params) => request('GET', `/api/transactions?${qs(params)}`),
  saveTransaction: (t) => (t.id ? request('PUT', `/api/transactions/${t.id}`, t) : request('POST', '/api/transactions', t)),
  deleteTransaction: (id) => request('DELETE', `/api/transactions/${id}`),
};
