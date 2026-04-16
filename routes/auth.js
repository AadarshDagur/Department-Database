const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { createAndSendOTP, verifyOTP } = require('../utils/otp');
const { normalizeUserType } = require('../utils/helpers');

// Landing page
router.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/landing');
});

// Login - show form
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login');
});

// Login - request OTP
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query('SELECT id, email, is_active FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      req.flash('error', 'No account found with that email');
      return res.redirect('/login');
    }
    const user = result.rows[0];
    if (!user.is_active) {
      req.flash('error', 'Your account has been deactivated');
      return res.redirect('/login');
    }
    await createAndSendOTP(user.id, user.email);
    req.session.pendingUserId = user.id;
    req.session.pendingEmail = user.email;
    req.flash('success', 'OTP sent to your email');
    res.redirect('/verify-otp');
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error', 'Failed to send OTP. Using password login instead.');
    res.redirect('/login-password');
  }
});

// Password login (fallback)
router.get('/login-password', (req, res) => {
  res.render('auth/login-password');
});

router.post('/login-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      `SELECT u.* 
       FROM users u 
       WHERE u.email = $1`, [email]
    );
    if (result.rows.length === 0) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/login-password');
    }
    const user = result.rows[0];
    if (!user.is_active) {
      req.flash('error', 'Account deactivated');
      return res.redirect('/login-password');
    }
    if (!user.password_hash) {
      req.flash('error', 'No password set. Use OTP login.');
      return res.redirect('/login');
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/login-password');
    }
    // Set session
    req.session.user = {
      id: user.id, email: user.email, username: user.username,
      first_name: user.first_name, last_name: user.last_name,
      user_type: normalizeUserType(user.user_type),
      profile_image: user.profile_image
    };
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    req.flash('success', 'Welcome back!');
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Password login error:', err);
    req.flash('error', 'Login failed');
    res.redirect('/login-password');
  }
});

// Verify OTP - show form
router.get('/verify-otp', (req, res) => {
  if (!req.session.pendingUserId) return res.redirect('/login');
  res.render('auth/verify-otp', { email: req.session.pendingEmail });
});

// Verify OTP - check
router.post('/verify-otp', async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.session.pendingUserId;
    if (!userId) {
      req.flash('error', 'Session expired. Please login again.');
      return res.redirect('/login');
    }
    const valid = await verifyOTP(userId, otp);
    if (!valid) {
      req.flash('error', 'Invalid or expired OTP');
      return res.redirect('/verify-otp');
    }
    // Get full user
    const result = await pool.query(
      `SELECT u.* 
       FROM users u 
       WHERE u.id = $1`, [userId]
    );
    const user = result.rows[0];
    req.session.user = {
      id: user.id, email: user.email, username: user.username,
      first_name: user.first_name, last_name: user.last_name,
      user_type: normalizeUserType(user.user_type),
      profile_image: user.profile_image
    };
    delete req.session.pendingUserId;
    delete req.session.pendingEmail;
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
    req.flash('success', 'Welcome back!');
    res.redirect('/dashboard');
  } catch (err) {
    console.error('OTP verify error:', err);
    req.flash('error', 'Verification failed');
    res.redirect('/verify-otp');
  }
});

// Self-registration is disabled. Only admins can create users from User Management.
router.get('/register', (req, res) => {
  req.flash('error', 'Self-registration is disabled. Please contact an admin.');
  return res.redirect('/login');
});

router.post('/register', (req, res) => {
  req.flash('error', 'Self-registration is disabled. Please contact an admin.');
  return res.redirect('/login');
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
