const express      = require('express');
const fetch        = require('node-fetch');
const router       = express.Router();
const { requireAuth }    = require('../middleware/auth');
const { cache, cacheStats, clearCache } = require('../middleware/cache');
const { validateLogEntry } = require('../middleware/sanitize');

// ─── GET /api/electricity-rate ────────────────────────────────────────────────
// Cached for 1 hour (3600s) — electricity rates don't change by the minute
router.get('/electricity-rate', requireAuth, cache(3600), async (req, res) => {
  try {
    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey) throw new Error('EIA_API_KEY not set');

    const params = new URLSearchParams({
      api_key: apiKey,
      frequency: 'monthly',
      'data[0]': 'price',
      'facets[sectorName][]': 'residential',
      'sort[0][column]': 'period',
      'sort[0][direction]': 'desc',
      length: '1',
      offset: '0'
    });

    const response = await fetch(
      `https://api.eia.gov/v2/electricity/retail-sales/data/?${params}`
    );
    if (!response.ok) throw new Error(`EIA HTTP ${response.status}`);

    const data   = await response.json();
    const record = data?.response?.data?.[0];
    if (!record)  throw new Error('No data in EIA response');

    res.json({
      price:  parseFloat(record.price),
      period: record.period,
      source: 'U.S. Energy Information Administration (EIA)',
    });
  } catch (err) {
    console.error('[api/electricity-rate] Failed to fetch rate');
    res.json({ price: 13.0, period: 'estimated', source: 'EIA 2024 average (fallback)' });
  }
});

// ─── GET /api/carbon-intensity ────────────────────────────────────────────────
// Cached for 15 minutes (900s) — carbon intensity changes more frequently
router.get('/carbon-intensity', requireAuth, cache(900), async (req, res) => {
  try {
    const apiKey = process.env.ELECTRICITY_MAPS_API_KEY;
    const zone   = req.query.zone || 'US-MIDA-PJM';
    if (!apiKey) throw new Error('ELECTRICITY_MAPS_API_KEY not set');

    const response = await fetch(
      `https://api.electricitymap.org/v3/carbon-intensity/latest?zone=${zone}`,
      { headers: { 'auth-token': apiKey } }
    );
    if (!response.ok) throw new Error(`Electricity Maps HTTP ${response.status}`);

    const data = await response.json();
    res.json({
      carbonIntensity: data.carbonIntensity,
      zone:            data.zone,
      datetime:        data.datetime,
      source:          'Electricity Maps',
    });
  } catch (err) {
    console.error('[api/carbon-intensity] Failed to fetch intensity');
    res.json({ carbonIntensity: 450, zone: 'estimated', source: 'Fallback estimate' });
  }
});

// ─── POST /api/validate-entry ─────────────────────────────────────────────────
// Server-side validation for log entries (extra layer on top of frontend validation)
router.post('/validate-entry', requireAuth, (req, res) => {
  const result = validateLogEntry(req.body);
  if (!result.valid) {
    return res.status(400).json({ error: 'Invalid entry data', details: result.errors });
  }
  res.json({ valid: true });
});

// ─── GET /api/cache-stats ─────────────────────────────────────────────────────
// Admin-only endpoint to monitor cache health
router.get('/cache-stats', requireAuth, (req, res) => {
  res.json(cacheStats());
});

// ─── DELETE /api/cache ────────────────────────────────────────────────────────
router.delete('/cache', requireAuth, (req, res) => {
  clearCache();
  res.json({ message: 'Cache cleared.' });
});

module.exports = router;
