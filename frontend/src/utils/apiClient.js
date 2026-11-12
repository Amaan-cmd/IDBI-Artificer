export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

const TOKEN_KEY = 'enverai_session_token';
const unauthorizedListeners = new Set();

export function getSessionToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setSessionToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

const paymentRequiredListeners = new Set();
const billingChangeListeners = new Set();

// Fired with the 402 body ({ action, priceCents, balanceCents }) when a paid action is refused.
export function onPaymentRequired(listener) {
  paymentRequiredListeners.add(listener);
  return () => paymentRequiredListeners.delete(listener);
}

// Fired after any response from a billable endpoint, so balances can refresh.
export function onBillingChange(listener) {
  billingChangeListeners.add(listener);
  return () => billingChangeListeners.delete(listener);
}

const BILLABLE_PATHS = ['/api/v1/evaluate', '/api/v1/chat/xai', '/api/v1/registry/', '/api/v1/alternate-data/gstin-probe/'];

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) unauthorizedListeners.forEach(fn => fn());
  if (res.status === 402) {
    const info = await res.clone().json().catch(() => ({}));
    paymentRequiredListeners.forEach(fn => fn(info));
  }
  if (BILLABLE_PATHS.some(p => path.startsWith(p))) billingChangeListeners.forEach(fn => fn());
  return res;
}
