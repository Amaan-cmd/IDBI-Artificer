// Microsoft Entra External ID sign-in (email code, Google or Apple on the
// hosted page). Client settings come from the backend at runtime.
import { PublicClientApplication } from '@azure/msal-browser';
import { API_BASE } from '../utils/apiClient';

const SCOPES = ['openid', 'profile', 'email'];
let msalPromise = null;

export function getMsal() {
  if (!msalPromise) {
    msalPromise = (async () => {
      const res = await fetch(`${API_BASE}/api/v1/auth/config`);
      const cfg = await res.json().catch(() => ({}));
      if (!res.ok || !cfg.clientId || !cfg.tenantSubdomain) throw new Error('Sign-in is not configured yet.');
      const host = `${cfg.tenantSubdomain}.ciamlogin.com`;
      const pca = new PublicClientApplication({
        auth: {
          clientId: cfg.clientId,
          authority: `https://${host}/`,
          knownAuthorities: [host],
          redirectUri: window.location.origin,
          postLogoutRedirectUri: window.location.origin
        },
        cache: { cacheLocation: 'sessionStorage' }
      });
      await pca.initialize();
      return pca;
    })().catch((err) => {
      msalPromise = null; // allow a retry after a transient failure
      throw err;
    });
  }
  return msalPromise;
}

// Leaves the page for the hosted sign-in; the result arrives via completeEntraRedirect().
export async function startEntraSignIn() {
  const pca = await getMsal();
  await pca.loginRedirect({ scopes: SCOPES, prompt: 'select_account' });
}

// ID token from a sign-in redirect that just returned to the app, or null.
export async function completeEntraRedirect() {
  const pca = await getMsal();
  const result = await pca.handleRedirectPromise();
  return result?.idToken || null;
}

// Forgets the Entra account in this tab; the app session is cleared separately.
export async function clearEntraAccount() {
  try {
    const pca = await getMsal();
    await pca.clearCache();
  } catch {
    // Not configured or never signed in: nothing to clear.
  }
}
