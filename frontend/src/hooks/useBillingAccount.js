import { useCallback, useEffect, useState } from 'react';
import { apiFetch, onBillingChange } from '../utils/apiClient';

// Loads /billing/account. Refreshes after billable calls and on window focus
// (to pick up Stripe top-ups completed in another tab).
export function useBillingAccount(enabled) {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/billing/account');
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setAccount(body);
        setError(null);
      } else if (res.status !== 401) {
        setError(body.error || `Billing unavailable (HTTP ${res.status})`);
      }
    } catch {
      setError('Billing unavailable. Check your connection.');
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAccount(null);
      return undefined;
    }
    refresh();
    const unsubscribe = onBillingChange(refresh);
    window.addEventListener('focus', refresh);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refresh);
    };
  }, [enabled, refresh]);

  return { account, error, refresh };
}
