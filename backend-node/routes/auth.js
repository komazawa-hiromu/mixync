// routes/auth.js (JWT-based authentication)
const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../lib/database');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();
const saltRounds = 10;

router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const stmt = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)');
    const info = stmt.run(email, hashedPassword);

    // Generate JWT token
    const token = generateToken({ id: info.lastInsertRowid, email });

    res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: { id: info.lastInsertRowid, email }
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ message: 'Email already exists.' });
    }
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('[AUTH] Login attempt for email:', email);

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    console.log('[AUTH] Querying database for user');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    console.log('[AUTH] User found:', user ? 'Yes' : 'No');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    console.log('[AUTH] Comparing passwords');
    const match = await bcrypt.compare(password, user.password);
    console.log('[AUTH] Password match:', match);

    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Generate JWT token
    console.log('[AUTH] Generating JWT token');
    const token = generateToken({ id: user.id, email: user.email });
    console.log('[AUTH] Token generated successfully');

    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, fitbit_user_id: user.fitbit_user_id }
    });
  } catch (error) {
    console.error('[AUTH] Error during login:', error);
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  // req.user is set by authenticateToken middleware
  const user = db.prepare('SELECT id, email, fitbit_user_id FROM users WHERE id = ?').get(req.user.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.status(200).json({ user });
});

router.post('/logout', (req, res) => {
  // With JWT, logout is handled client-side by removing the token
  res.status(200).json({ message: 'Logout successful.' });
});

// Note: Fitbit OAuth requires special handling with JWT
// We accept the token as a query parameter and verify it
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

router.get('/fitbit', (req, res, next) => {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[AUTH] Decoded token:', decoded);
    console.log('[AUTH] User ID:', decoded.id);

    // Get frontend URL from referer or use default
    const referer = req.get('Referer') || req.get('Origin');
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (referer) {
      try {
        const refererUrl = new URL(referer);
        frontendUrl = `${refererUrl.protocol}//${refererUrl.host}`;
        console.log('[AUTH] Detected frontend URL from referer:', frontendUrl);
      } catch (e) {
        console.log('[AUTH] Could not parse referer, using default:', frontendUrl);
      }
    }

    // Encode user ID and frontend URL in state parameter (base64 for safety)
    const state = Buffer.from(JSON.stringify({
      userId: decoded.id,
      frontendUrl: frontendUrl
    })).toString('base64');

    console.log('[AUTH] Initiating Fitbit OAuth for user:', decoded.id);
    console.log('[AUTH] Frontend URL:', frontendUrl);
    console.log('[AUTH] State parameter:', state);

    // Initiate Fitbit OAuth flow with state parameter
    passport.authenticate('fitbit', {
      state: state,
      scope: ['activity', 'heartrate', 'location', 'nutrition', 'profile', 'settings', 'sleep', 'social', 'weight', 'oxygen_saturation', 'respiratory_rate', 'temperature']
    })(req, res, next);
  } catch (error) {
    console.error('[AUTH] Token verification error:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
});

router.get('/fitbit/callback', (req, res, next) => {
  // Extract frontend URL from state parameter
  let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (req.query.state) {
    try {
      const stateData = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
      if (stateData.frontendUrl) {
        frontendUrl = stateData.frontendUrl;
        console.log('[AUTH] Using frontend URL from state:', frontendUrl);
      }
    } catch (e) {
      console.log('[AUTH] Could not parse state parameter, using default frontend URL');
    }
  }

  passport.authenticate('fitbit', {
    failureRedirect: `${frontendUrl}/login`,
    successRedirect: `${frontendUrl}/fitbit-success`
  })(req, res, next);
});

router.get('/clear-fitbit', (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get frontend URL from referer or use default
    const referer = req.get('Referer') || req.get('Origin');
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (referer) {
      try {
        const refererUrl = new URL(referer);
        frontendUrl = `${refererUrl.protocol}//${refererUrl.host}`;
        console.log('[AUTH] Detected frontend URL from referer:', frontendUrl);
      } catch (e) {
        console.log('[AUTH] Could not parse referer, using default:', frontendUrl);
      }
    }

    const stmt = db.prepare('UPDATE users SET fitbit_access_token = NULL, fitbit_refresh_token = NULL, fitbit_user_id = NULL WHERE id = ?');
    stmt.run(decoded.id);

    // Redirect back to home page
    res.redirect(`${frontendUrl}/`);
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
});

module.exports = router;
