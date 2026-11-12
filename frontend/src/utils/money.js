export function formatCents(cents) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

// Balance as a 0-100 share of everything the account has been granted or bought.
export function creditBarPercent(account) {
  if (!account || typeof account.balanceCents !== 'number') return 0;
  const free = account.freeGrantCents || 0;
  const max = Math.max(free || 500, free + (account.lifetimePurchasedCents || 0));
  return Math.min(100, Math.max(0, (account.balanceCents / max) * 100));
}
