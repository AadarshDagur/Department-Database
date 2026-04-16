const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const upload = require('../middleware/upload');
const { isLoggedIn, isStaffOrAdmin } = require('../middleware/auth');
// ...existing code...
// ...existing code...

function normalizeQueryCategory(rawCategory) {
  const input = String(rawCategory || '').trim().toLowerCase();
  if (!input) return 'General';
  if (['bug', 'bug report'].includes(input)) return 'Bug';
  if (['feature request', 'feature'].includes(input)) return 'Feature Request';
  if (['general', 'general query', 'access issue', 'data correction'].includes(input)) return 'General';
  if (input === 'other') return 'Other';
  return 'General';
}

// Queries landing: admin sees management page, others see submit form
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const userType = req.session.user.user_type;
    if (userType !== 'admin') {
      return res.render('queries/form');
    }

    const { status, category, q } = req.query;
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const normalizedCategory = normalizeQueryCategory(category);
    const where = [];
    const params = [];

    if (normalizedStatus === 'resolved') {
      params.push('Resolved');
      where.push(`q.status = $${params.length}`);
    } else if (normalizedStatus === 'unresolved') {
      params.push('Resolved');
      where.push(`q.status <> $${params.length}`);
    }
    if (category) {
      params.push(normalizedCategory);
      where.push(`q.category = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(q.subject ILIKE $${params.length} OR q.description ILIKE $${params.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const queriesResult = await pool.query(
      `SELECT
         q.*,
        CASE WHEN q.status = 'Resolved' THEN 'Resolved' ELSE 'Unresolved' END AS query_status,
         u.first_name || ' ' || u.last_name AS requester_name,
         u.email AS requester_email
       FROM queries q
       LEFT JOIN users u ON q.user_id = u.id
       ${whereSql}
       ORDER BY q.created_at DESC`,
      params
    );

    res.render('queries/index', {
      items: queriesResult.rows,
      filters: {
        status: normalizedStatus === 'resolved' ? 'Resolved' : (normalizedStatus === 'unresolved' ? 'Unresolved' : ''),
        category: category ? normalizedCategory : '',
        q: q || ''
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load queries');
    res.redirect('/dashboard');
  }
});

// Contact/query form (non-admin users)
router.get('/new', isLoggedIn, (req, res) => {
  res.render('queries/form');
});

// Admin response: resolve query and notify requester
router.post('/:id/respond', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const responseMessage = String(req.body.response_message || '').trim();
    if (!responseMessage) {
      req.flash('error', 'Response message is required');
      return res.redirect('/queries');
    }

    const queryResult = await pool.query(
      'SELECT id, user_id, subject, status FROM queries WHERE id = $1',
      [req.params.id]
    );
    if (queryResult.rows.length === 0) {
      req.flash('error', 'Query not found');
      return res.redirect('/queries');
    }

    const queryItem = queryResult.rows[0];

    if (queryItem.status === 'Resolved') {
      req.flash('info', 'This query is already resolved.');
      return res.redirect('/queries');
    }

    await pool.query('UPDATE queries SET status = $1 WHERE id = $2', ['Resolved', req.params.id]);

    if (queryItem.user_id) {
      await pool.query(
        `INSERT INTO user_notifications (user_id, title, message)
         VALUES ($1, $2, $3)`,
        [
          queryItem.user_id,
          'Response to your query',
          `Your query "${queryItem.subject}" has a response: ${responseMessage}`
        ]
      );
    }

    req.flash('success', 'Response sent to user notification');
    res.redirect('/queries');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to send response');
    res.redirect('/queries');
  }
});

// Submit query
router.post('/', isLoggedIn, upload.single('screenshot'), async (req, res) => {
  try {
    const { subject, description, category } = req.body;
    const normalizedCategory = normalizeQueryCategory(category);
    const userId = req.session && req.session.user ? req.session.user.id : null;
    const screenshot = req.file ? `/uploads/${req.file.filename}` : null;

    await pool.query(
      'INSERT INTO queries (user_id, subject, description, category, screenshot) VALUES ($1, $2, $3, $4, $5)',
      [userId, subject, description, normalizedCategory, screenshot]
    );

    // ...existing code...
// ...existing code...

    req.flash('success', 'Your query has been submitted');
    if (req.session.user.user_type === 'admin') {
      return res.redirect('/queries');
    }
    res.redirect('/queries/new');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to submit query');
    if (req.session.user && req.session.user.user_type === 'admin') {
      return res.redirect('/queries');
    }
    res.redirect('/queries/new');
  }
});

module.exports = router;
