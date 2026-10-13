/**
 * EnverAI SecOps Input Sanitization Engine
 * Protects against XSS, null byte injection, control character tampering,
 * Unicode directional overrides (Bidi spoofing), and malicious payloads.
 */

/**
 * Sanitizes generic single-line text (usernames, names, handles).
 * Strips HTML tags, null bytes, ASCII control chars, and Unicode bidi overrides.
 *
 * @param {string} val - Raw input value
 * @param {number} maxLen - Maximum character length (default 64)
 * @returns {string} Sanitized string
 */
export function sanitizeText(val, maxLen = 64) {
  if (typeof val !== 'string') return '';

  return val
    // Normalize Unicode to canonical equivalence
    .normalize('NFKC')
    // Strip null bytes and ASCII control characters (0x00-0x1F, 0x7F-0x9F)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Strip Unicode directional formatting characters (Bidi overrides)
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    // Strip HTML/XML tags
    .replace(/<[^>]*>?/gm, '')
    // Strip excessive whitespaces
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Sanitizes password fields without corrupting allowed punctuation / symbols,
 * while stripping null bytes, control characters, and bidi overrides.
 *
 * @param {string} val - Raw password
 * @param {number} maxLen - Maximum character length (default 128)
 * @returns {string} Sanitized password
 */
export function sanitizePassword(val, maxLen = 128) {
  if (typeof val !== 'string') return '';

  return val
    // Strip null bytes and non-printable control characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Strip Unicode bidi overrides
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Sanitizes email addresses to standard valid email character subset.
 *
 * @param {string} val - Raw email address
 * @param {number} maxLen - Maximum character length (default 100)
 * @returns {string} Sanitized lowercase email
 */
export function sanitizeEmail(val, maxLen = 100) {
  if (typeof val !== 'string') return '';

  return val
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/<[^>]*>?/gm, '')
    // Whitelist valid email characters: letters, digits, and . _ % + - @
    .replace(/[^a-zA-Z0-9.@+_%-]/g, '')
    .trim()
    .toLowerCase()
    .slice(0, maxLen);
}

/**
 * Sanitizes numeric one-time-passcode (OTP) digits.
 *
 * @param {string} val - Raw numeric input
 * @param {number} maxLen - Maximum length (default 6)
 * @returns {string} Digits only
 */
export function sanitizeOtpDigits(val, maxLen = 6) {
  if (typeof val !== 'string') return '';
  return val.replace(/\D/g, '').slice(0, maxLen);
}

/**
 * Validates whether an input contains obvious injection or malicious script attempts.
 *
 * @param {string} val - Input to inspect
 * @returns {boolean} True if safe, false if suspicious
 */
export function isSafeInput(val) {
  if (!val || typeof val !== 'string') return true;
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /onerror\s*=/gi,
    /onload\s*=/gi,
    /eval\s*\(/gi,
    /document\.cookie/gi,
    /window\.localStorage/gi
  ];
  return !suspiciousPatterns.some((pattern) => pattern.test(val));
}
