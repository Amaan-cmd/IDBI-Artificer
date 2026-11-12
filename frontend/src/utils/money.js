export function formatCents(cents) {
  return typeof cents === 'number' && Number.isFinite(cents) ? `$${(cents / 100).toFixed(2)}` : '—';
}
