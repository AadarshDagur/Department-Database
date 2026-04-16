const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isLoggedIn, isStaffOrAdmin } = require('../middleware/auth');
const { sendMail: sendEmail } = require('../config/email');

router.get('/', isLoggedIn, async (req, res) => {
  try {
    const userType = req.session.user.user_type;

    const directRes = await pool.query(
      `SELECT n.* FROM user_notifications n WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 50`,
      [req.session.user.id]
    );

    const broadcastRes = await pool.query(
      `SELECT bn.*, u.first_name || ' ' || u.last_name as sender_name
       FROM broadcast_notifications bn LEFT JOIN users u ON bn.created_by = u.id
       WHERE (bn.target_role IS NULL OR bn.target_role = $1)
       AND (bn.expires_at IS NULL OR bn.expires_at > NOW())
       ORDER BY bn.created_at DESC`,
      [userType]
    );

    res.render('notifications/index', { userNotifs: directRes.rows, broadcasts: broadcastRes.rows });
  } catch (err) {
    console.error('NOTIF ERROR:', err); req.flash('error', 'Failed to load notifications');
    res.redirect('/dashboard');
  }
});

router.put('/:id/read', isLoggedIn, async (req, res) => {
  try {
    await pool.query('UPDATE user_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.session.user.id]);
    res.redirect('/notifications');
  } catch (err) {
    req.flash('error', 'Failed to mark as read');
    res.redirect('/notifications');
  }
});

router.post('/read-all', isLoggedIn, async (req, res) => {
  try {
    await pool.query('UPDATE user_notifications SET is_read = TRUE WHERE user_id = $1', [req.session.user.id]);
    const returnUrl = req.get('referer') || '/notifications';
    res.redirect(returnUrl);
  } catch (err) {
    req.flash('error', 'Failed to mark as read');
    res.redirect('/notifications');
  }
});

router.get('/broadcast', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  res.render('notifications/broadcast');
});

router.post('/broadcast', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const { title, message, target_role, expires_hours, send_email } = req.body;
    const expiresAt = expires_hours ? new Date(Date.now() + Number(expires_hours) * 60 * 60 * 1000) : null;
    const role = target_role || null;

    await pool.query(
        `INSERT INTO broadcast_notifications (title, message, target_role, created_by, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [title, message, role, req.session.user.id, expiresAt]
    );

    if (send_email === 'true') {
      let emailWhere = 'is_active = TRUE';
      const emailParams = [];
      if (role) {
        emailParams.push(role);
        emailWhere += ` AND user_type = $${emailParams.length}`;
      }

      const users = await pool.query(`SELECT email FROM users WHERE ${emailWhere}`, emailParams);
      if (users.rows.length > 0) {
        const bcc = users.rows.map(u => u.email).join(', ');
        const html = `<h2>${title}</h2><p>${message}</p><hr><p><small>This is an automated broadcast from the Portal.</small></p>`;
        await sendEmail({ to: req.session.user.email, bcc, subject: `Notice: ${title}`, html });
      }
    }

    req.flash('success', 'Broadcast sent');
    res.redirect('/notifications');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to send broadcast');
    res.redirect('/notifications/broadcast');
  }
});



router.delete('/broadcast/:id', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM broadcast_notifications WHERE id = $1', [req.params.id]);
    req.flash('success', 'Broadcast deleted');
  } catch (err) {
    req.flash('error', 'Failed to delete broadcast');
  }
  res.redirect('/notifications');
});
module.exports = router;
