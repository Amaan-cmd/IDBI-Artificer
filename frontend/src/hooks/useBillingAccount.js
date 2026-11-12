import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, onBillingChange } from '../utils/apiClient';

const FOCUS_THROTTLE_MS = 15000;
const FAILURE_RETRY_MS = 1500;

// Loads /billing/account. Refreshes after billable calls and on window focus
// (to pick up Stripe top-ups completed in another tab).
export function useBillingAccount(enabled) {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState(null);
  // Only the latest request may apply its result; disabling bumps it too.
  const reqIdRef = useRef(0);
  const lastStartedRef = useRef(0);

  const refresh = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    lastStartedRef.current = Date.now();
    try {
      const res = await apiFetch('/api/v1/billing/account');
      const body = await res.json().catch(() => ({}));
      if (reqId !== reqIdRef.current) return;
      if (res.ok) {
        setAccount(body);
        setError(null);
      } else if (res.status !== 401) {
        setError(body.error || `Billing unavailable (HTTP ${res.status})`);
      }
    } catch {
      if (reqId !== reqIdRef.current) return;
      setError('Billing unavailable. Check your connection.');
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      reqIdRef.current += 1;
      setAccount(null);
      setError(null);
      return undefined;
    }
    let retryTimer = null;
    refresh();
    // A failed paid call is refunded asynchronously; read again shortly after.
    const unsubscribe = onBillingChange((outcome) => {
      refresh();
      if (outcome?.ok === false) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(refresh, FAILURE_RETRY_MS);
      }
    });
    const onFocus = () => {
      if (Date.now() - lastStartedRef.current < FOCUS_THROTTLE_MS) return;
      refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      unsubscribe();
      clearTimeout(retryTimer);
      window.removeEventListener('focus', onFocus);
      reqIdRef.current += 1;
    };
  }, [enabled, refresh]);

  return { account, error, refresh };
}
