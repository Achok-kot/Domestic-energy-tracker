require('dotenv').config();
const express   = require('express');
const path      = require('path');
const rateLimit = require('express-rate-limit');
const { sanitizeInputs } = require('./middleware/sanitize');
 
const app  = express();
const PORT = process.env.PORT || 3000;
 
// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
 
// Input sanitization
app.use(sanitizeInputs);
 
// Rate limiting on auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Please try again later.' },
});
 
// Rate limiting on API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Rate limit exceeded.' },
});
 
// Static frontend
app.use(express.static(path.join(__dirname, 'public')));
 
// Routes
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api',      apiLimiter,  require('./routes/apiRoutes'));
 
// Health check
app.get('/health', function(req, res) {
  res.json({
    status:    'ok',
    uptime:    process.uptime(),
    timestamp: new Date().toISOString(),
    server:    process.env.SERVER_NAME || 'web',
  });
});
 
// Global error handler
app.use(function(err, req, res, next) {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});
 
// Catch-all
app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
 
app.listen(PORT, function() {
  console.log('EnergyIQ running on port ' + PORT);
});

