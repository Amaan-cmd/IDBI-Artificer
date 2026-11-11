/**
 * HTTP client for Sandbox (sandbox.co.in) public GST and MCA21 APIs.
 * Never logs credentials or tokens.
 */
const DEFAULT_BASE_URL = 'https://api.sandbox.co.in';
const TOKEN_TTL_MS = 23 * 3600 * 1000;
const NOT_FOUND_CODES = new Set(['FO8000', 'RET13510']);

function createSandboxClient({
  apiKey = process.env.SANDBOX_API_KEY,
  apiSecret = process.env.SANDBOX_API_SECRET,
  baseUrl = process.env.SANDBOX_BASE_URL || DEFAULT_BASE_URL,
  fetchImpl = (...args) => fetch(...args),
  timeoutMs = 10000,
  now = () => Date.now()
} = {}) {
  let token = null;
  let tokenExpiresAt = 0;
  let inflightAuth = null;

  const request = (url, init) => fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

  async function authenticate() {
    if (!apiKey || !apiSecret) {
      return { error: { ok: false, kind: 'unavailable', code: 'NO_CREDENTIALS', message: 'Sandbox credentials are not configured', transactionId: null } };
    }
    try {
      const res = await request(`${baseUrl}/authenticate`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'x-api-version': '1.0' }
      });
      const body = await res.json().catch(() => null);
      const accessToken = body?.data?.access_token;
      if (!res.ok || !accessToken) {
        console.warn(`[Sandbox] Authentication failed (HTTP ${res.status})`);
        return { error: { ok: false, kind: 'unavailable', code: `AUTH_${res.status}`, message: 'Sandbox authentication failed', transactionId: body?.transaction_id || null } };
      }
      token = accessToken;
      tokenExpiresAt = now() + TOKEN_TTL_MS;
      return { token };
    } catch (err) {
      return { error: { ok: false, kind: 'unavailable', code: 'NETWORK', message: err.message, transactionId: null } };
    }
  }

  // Concurrent callers share a single in-flight /authenticate request.
  function getToken() {
    if (token && now() < tokenExpiresAt) return Promise.resolve({ token });
    if (!inflightAuth) {
      inflightAuth = authenticate().finally(() => { inflightAuth = null; });
    }
    return inflightAuth;
  }

  // Only discard the token that was actually rejected; a concurrent request
  // may already have replaced it with a fresh one.
  function invalidate(staleToken) {
    if (token === staleToken) {
      token = null;
      tokenExpiresAt = 0;
    }
  }

  async function send(method, pathAndQuery, body, attempt = 0, reauthenticated = false) {
    const auth = await getToken();
    if (auth.error) return auth.error;

    let res;
    try {
      res = await request(`${baseUrl}${pathAndQuery}`, {
        method,
        headers: {
          authorization: auth.token,
          'x-api-key': apiKey,
          'x-api-version': '1.0.0',
          'Content-Type': 'application/json',
          'x-accept-cache': 'true'
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (err) {
      if (attempt < 1) return send(method, pathAndQuery, body, attempt + 1, reauthenticated);
      return { ok: false, kind: 'unavailable', code: 'NETWORK', message: err.message, transactionId: null };
    }

    if ((res.status === 401 || res.status === 403) && !reauthenticated) {
      invalidate(auth.token);
      return send(method, pathAndQuery, body, attempt, true);
    }
    if (res.status >= 500 && res.status !== 521 && attempt < 1) {
      return send(method, pathAndQuery, body, attempt + 1, reauthenticated);
    }

    const json = await res.json().catch(() => null);
    const transactionId = json?.transaction_id || null;
    if (!json) return { ok: false, kind: 'provider_error', code: `HTTP_${res.status}`, message: 'Unreadable provider response', transactionId };

    const code = Number(json.code ?? res.status);
    if (code === 200 && json.data && json.data.status_cd === '0') {
      const e = json.data.error || {};
      const errorCode = e.error_cd || e.error_code || 'UNKNOWN';
      return { ok: false, kind: NOT_FOUND_CODES.has(errorCode) ? 'not_found' : 'provider_error', code: errorCode, message: e.message || 'Provider error', transactionId };
    }
    if (code === 200) return { ok: true, body: json, transactionId };
    if (code === 521 || code === 404) return { ok: false, kind: 'not_found', code: String(code), message: json.message || 'Not found', transactionId };
    if (code === 400 || code === 422) return { ok: false, kind: 'invalid_input', code: String(code), message: json.message || 'Invalid input', transactionId };
    return { ok: false, kind: 'unavailable', code: String(code), message: json.message || `HTTP ${res.status}`, transactionId };
  }

  return {
    post: (pathAndQuery, body) => send('POST', pathAndQuery, body),
    get: (pathAndQuery) => send('GET', pathAndQuery, undefined)
  };
}

let defaultClient = null;
function getSandboxClient() {
  if (!defaultClient) defaultClient = createSandboxClient();
  return defaultClient;
}

module.exports = { createSandboxClient, getSandboxClient };
