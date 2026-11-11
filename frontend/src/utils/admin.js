// UI gate only; the server enforces admin access on every admin endpoint.
export function isAdminUser(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  return at > 0 && email.slice(at + 1) === 'enveraitech.com';
}
