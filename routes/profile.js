const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { isLoggedIn } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { formatUserType } = require('../utils/helpers');

// Profile directory - list all users
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const typeFilter = req.query.type || '';
    
    let where = 'is_active = TRUE';
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }
    if (typeFilter) {
      if (typeFilter === 'student') {
        where += ` AND user_type IN ('student')`;
      } else if (typeFilter === 'admin') {
        where += ` AND user_type = 'admin'`;
      } else {
        params.push(typeFilter);
        where += ` AND user_type = $${params.length}`;
      }
    }

    const users = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.user_type, u.profile_image
      FROM users u
      WHERE ${where}
      ORDER BY u.first_name
      LIMIT 100
    `, params);
    
    res.render('profile/directory', {
      items: users.rows,
      users: users.rows,
      query: req.query,
      search,
      selectedType: typeFilter,
      formatUserType
    });
  } catch (err) {
    req.flash('error', 'Failed to load directory');
    res.redirect('/dashboard');
  }
});

// View own profile
router.get('/me', isLoggedIn, async (req, res) => {
  res.redirect(`/profile/${req.session.user.id}`);
});

// View profile
router.get('/:id', isLoggedIn, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*
      FROM users u
      WHERE u.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) { req.flash('error', 'User not found'); return res.redirect('/profile'); }
    const user = result.rows[0];

    // Get role-specific details
    let details = null;
    if (['student'].includes(user.user_type)) {
      const sd = await pool.query(`
        SELECT sd.*, u.first_name || ' ' || u.last_name as advisor_name
        FROM student_details sd LEFT JOIN users u ON sd.faculty_advisor_id = u.id
        WHERE sd.user_id = $1
      `, [user.id]);
      details = sd.rows[0] || null;
    }

    // Recent activity
    const recentPubs = await pool.query(
      "SELECT id, title, created_date FROM publications WHERE created_by = $1 AND object_type = 'A' AND is_deleted = FALSE ORDER BY created_date DESC LIMIT 5", [user.id]
    );

    const isOwnProfile = req.session.user.id === user.id;

    const recentItems = recentPubs.rows.map((p) => ({
      category: 'Publication',
      title: p.title,
      created_date: p.created_date
    }));

    res.render('profile/show', { item: user, user, details, recentItems, recentPubs: recentPubs.rows, formatUserType, isOwnProfile });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load profile');
    res.redirect('/profile');
  }
});

// Edit profile form
router.get('/:id/edit', isLoggedIn, async (req, res) => {
  if (parseInt(req.params.id) !== req.session.user.id) {
    req.flash('error', 'You can only edit your own profile');
    return res.redirect(`/profile/${req.params.id}`);
  }
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);

  res.render('profile/edit', { user: result.rows[0] });
});

// Update profile
router.put('/:id', isLoggedIn, upload.single('profile_image'), async (req, res) => {
  try {
    if (parseInt(req.params.id) !== req.session.user.id) {
      req.flash('error', 'Not authorized');
      return res.redirect(`/profile/${req.params.id}`);
    }
    const { first_name, last_name, get_otp_email, get_email_notification, get_email_broadcast } = req.body;
    const profileImage = req.file ? `/uploads/${req.file.filename}` : undefined;

    let sql = `UPDATE users SET first_name = $1, last_name = $2,
      get_otp_email = $3, get_email_notification = $4, get_email_broadcast = $5`;
    const params = [first_name, last_name || '',
      get_otp_email === 'on', get_email_notification === 'on', get_email_broadcast === 'on'];

    if (profileImage) {
      params.push(profileImage);
      sql += `, profile_image = $${params.length}`;
    }
    params.push(req.params.id);
    sql += ` WHERE id = $${params.length}`;
    await pool.query(sql, params);

    // Update session
    req.session.user.first_name = first_name;
    req.session.user.last_name = last_name || '';
    if (profileImage) req.session.user.profile_image = profileImage;

    req.flash('success', 'Profile updated');
    res.redirect(`/profile/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update profile');
    res.redirect(`/profile/${req.params.id}/edit`);
  }
});

// Change password
router.post('/:id/password', isLoggedIn, async (req, res) => {
  try {
    if (parseInt(req.params.id) !== req.session.user.id) {
      req.flash('error', 'Not authorized');
      return res.redirect(`/profile/${req.params.id}`);
    }
    const { current_password, new_password, confirm_password } = req.body;      
    if (new_password !== confirm_password) {
      req.flash('error', 'Passwords do not match');
      return res.redirect(`/profile/${req.params.id}/edit`);
    }
    const user = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.params.id]);
    if (user.rows[0].password_hash) {
      const valid = await bcrypt.compare(current_password, user.rows[0].password_hash);
      if (!valid) {
        req.flash('error', 'Current password is incorrect');
        return res.redirect(`/profile/${req.params.id}/edit`);
      }
    }
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
    req.flash('success', 'Password updated');
    res.redirect(`/profile/${req.params.id}`);
  } catch (err) {
    req.flash('error', 'Failed to update password');
    res.redirect(`/profile/${req.params.id}/edit`);
  }
});

module.exports = router;
