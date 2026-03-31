/**
 * Simple in-memory cache for API responses.
 * Avoids hammering external APIs on every request and speeds up response times.
 *
 * Usage:
 *   router.get('/some-endpoint', cache(300), handler);
 *   // 300 = TTL in seconds
 */

const store = new Map();

/**
 * Returns Express middleware that caches the response for `ttlSeconds`.
 * Cache key is the full request URL.
 */
function cache(ttlSeconds = 300) {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cached = store.get(key);

    if (cached && Date.now() < cached.expiresAt) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Age', Math.floor((Date.now() - cached.createdAt) / 1000) + 's');
      return res.json(cached.data);
    }

    // Monkey-patch res.json so we can intercept and store the response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      store.set(key, {
        data,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
}

/**
 * Returns cache statistics — useful for monitoring.
 */
function cacheStats() {
  const now = Date.now();
  let active = 0, expired = 0;
  store.forEach((v) => (now < v.expiresAt ? active++ : expired++));
  return { totalKeys: store.size, activeKeys: active, expiredKeys: expired };
}

/**
 * Clears all cached entries.
 */
function clearCache() {
  store.clear();
}

module.exports = { cache, cacheStats, clearCache };
