/**
 * Input validation and XSS protection middleware.
 *
 * Protects against:
 *  - Cross-Site Scripting (XSS) via HTML/script tag injection
 *  - SQL injection patterns in string inputs
 *  - Prototype pollution via __proto__ / constructor keys
 *  - Oversized payloads (handled via express body limit)
 */

// Characters and patterns that indicate XSS attempts
const XSS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<[^>]+on\w+\s*=\s*["'][^"']*["']/gi,  // onclick=, onerror= etc.
  /javascript\s*:/gi,
  /data\s*:\s*text\/html/gi,
  /<iframe[\s\S]*?>/gi,
  /<object[\s\S]*?>/gi,
  /<embed[\s\S]*?>/gi,
  /vbscript\s*:/gi,
];

// Basic SQL injection patterns
const SQL_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|TRUNCATE)\b)/gi,
  /(--|;|\/\*|\*\/)/g,
  /(\bOR\b|\bAND\b)\s+['"\d]/gi,
];

// Keys that could cause prototype pollution
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Escapes HTML special characters in a string.
 * This is the core XSS prevention — output encoding.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Checks a string value for XSS attack patterns.
 * Returns true if a threat is detected.
 */
function containsXSS(value) {
  if (typeof value !== 'string') return false;
  return XSS_PATTERNS.some((p) => p.test(value));
}

/**
 * Checks a string value for SQL injection patterns.
 * Returns true if a threat is detected.
 */
function containsSQL(value) {
  if (typeof value !== 'string') return false;
  return SQL_PATTERNS.some((p) => p.test(value));
}

/**
 * Recursively sanitizes an object's string values.
 * Throws if XSS or SQL injection is detected.
 */
function sanitizeObject(obj, path = '') {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    if (containsXSS(obj)) throw new Error(`XSS pattern detected at ${path}`);
    if (containsSQL(obj)) throw new Error(`SQL injection pattern detected at ${path}`);
    return escapeHtml(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item, i) => sanitizeObject(item, `${path}[${i}]`));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key of Object.keys(obj)) {
      if (DANGEROUS_KEYS.includes(key)) {
        throw new Error(`Prototype pollution attempt detected: key "${key}"`);
      }
      sanitized[key] = sanitizeObject(obj[key], `${path}.${key}`);
    }
    return sanitized;
  }

  return obj; // numbers, booleans pass through
}

/**
 * Express middleware — sanitizes req.body, req.query, and req.params.
 * Skips password fields to avoid blocking valid passwords.
 * Responds with 400 if any malicious input is detected.
 */
function sanitizeInputs(req, res, next) {
  try {
    if (req.body) {
      // Temporarily remove password before sanitizing, then restore it
      const password = req.body.password;
      delete req.body.password;
      req.body = sanitizeObject(req.body, 'body');
      if (password !== undefined) req.body.password = password;
    }
    if (req.query)  req.query  = sanitizeObject(req.query,  'query');
    if (req.params) req.params = sanitizeObject(req.params, 'params');
    next();
  } catch (err) {
    console.warn(`[sanitize] Blocked request from ${req.ip}: ${err.message}`);
    res.status(400).json({ error: 'Invalid input detected.', detail: err.message });
  }
}

/**
 * Validates a registration/login payload.
 * Returns { valid: true } or { valid: false, errors: [...] }
 */
function validateAuthPayload(body) {
  const errors = [];

  if (!body.username || typeof body.username !== 'string') {
    errors.push('Username is required.');
  } else if (!/^[a-zA-Z0-9_]{3,30}$/.test(body.username)) {
    errors.push('Username must be 3–30 alphanumeric characters or underscores.');
  }

  if (!body.password || typeof body.password !== 'string') {
    errors.push('Password is required.');
  } else if (body.password.length < 8) {
    errors.push('Password must be at least 8 characters.');
  } else if (!/[A-Z]/.test(body.password)) {
    errors.push('Password must contain at least one uppercase letter.');
  } else if (!/[0-9]/.test(body.password)) {
    errors.push('Password must contain at least one number.');
  }

  return errors.length ? { valid: false, errors } : { valid: true };
}

/**
 * Validates a new energy log entry payload.
 */
function validateLogEntry(body) {
  const errors = [];

  if (!body.appliance || typeof body.appliance !== 'string' || body.appliance.trim().length < 2) {
    errors.push('Appliance name must be at least 2 characters.');
  }
  if (body.appliance && body.appliance.length > 100) {
    errors.push('Appliance name must not exceed 100 characters.');
  }

  const watts = parseFloat(body.watts);
  if (isNaN(watts) || watts <= 0 || watts > 100000) {
    errors.push('Watts must be a positive number up to 100,000.');
  }

  const hours = parseFloat(body.hours);
  if (isNaN(hours) || hours <= 0 || hours > 24) {
    errors.push('Hours must be between 0 and 24.');
  }

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    errors.push('Date must be in YYYY-MM-DD format.');
  }

  return errors.length ? { valid: false, errors } : { valid: true };
}

module.exports = { sanitizeInputs, validateAuthPayload, validateLogEntry, escapeHtml };
