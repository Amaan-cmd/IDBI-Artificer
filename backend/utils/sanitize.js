/**
 * EnverAI SecOps Backend Input Sanitization Engine
 * Defensive normalization and stripping of control characters,
 * null bytes, HTML tags, and Unicode directional formatting exploits.
 */

function sanitizeText(val, maxLen = 64) {
  if (typeof val !== 'string') return '';
  return val
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/<[^>]*>?/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function sanitizePassword(val, maxLen = 128) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .trim()
    .slice(0, maxLen);
}

function sanitizeEmail(val, maxLen = 100) {
  if (typeof val !== 'string') return '';
  return val
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/<[^>]*>?/gm, '')
    .replace(/[^a-zA-Z0-9.@+_%-]/g, '')
    .trim()
    .toLowerCase()
    .slice(0, maxLen);
}

function sanitizeOtpDigits(val, maxLen = 6) {
  if (typeof val !== 'string') return '';
  return val.replace(/\D/g, '').slice(0, maxLen);
}

function isSafeInput(val) {
  if (!val || typeof val !== 'string') return true;
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /onerror\s*=/gi,
    /onload\s*=/gi,
    /eval\s*\(/gi
  ];
  return !suspiciousPatterns.some((pattern) => pattern.test(val));
}

module.exports = {
  sanitizeText,
  sanitizePassword,
  sanitizeEmail,
  sanitizeOtpDigits,
  isSafeInput
};
