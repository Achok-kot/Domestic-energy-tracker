const express  = require('express');
const bcrypt   = require('bcryptjs');
const router   = express.Router();
const fs       = require('fs');
const path     = require('path');
const { generateToken }       = require('../middleware/auth');
const { validateAuthPayload } = require('../middleware/sanitize');

// ─── File-based user store ────────────────────────────────────────────────────
// Persists users to a JSON file so they survive server restarts
const USERS_FILE = path.join(__dirname, '../data/users.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(USERS_FILE))) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
}

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return new Map();
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return new Map(Object.entries(data));
  } catch { return new Map(); }
}

function saveUsers(users) {
  try {
    const obj = {};
    users.forEach((v, k) => obj[k] = v);
    fs.writeFileSync(USERS_FILE, JSON.stringify(obj, null, 2));
  } catch (err) { console.error('[auth] Failed to save users:', err.message); }
}

const users = loadUsers();

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate inputs
    const validation = validateAuthPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }

    // Check if username already taken
    if (users.has(username.toLowerCase())) {
      return res.status(409).json({ error: 'Username already taken. Please choose another.' });
    }

    // Hash password with bcrypt (12 salt rounds)
    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
      id:           Date.now().toString(),
      username:     username.toLowerCase(),
      passwordHash,
      createdAt:    new Date().toISOString(),
    };

    users.set(user.username, user);
    saveUsers(users);

    const token = generateToken(user);
    res.status(201).json({
      message:  'Account created successfully.',
      token,
      username: user.username,
    });
  } catch (err) {
    console.error('[auth/register]', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate inputs
    const validation = validateAuthPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }

    const user = users.get(username.toLowerCase());

    // Use a generic error message to avoid username enumeration
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = generateToken(user);
    res.json({
      message:  'Login successful.',
      token,
      username: user.username,
    });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', require('../middleware/auth').requireAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

module.exports = router;
