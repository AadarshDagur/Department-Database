const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isLoggedIn } = require('../middleware/auth');

router.get('/', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userType = req.session.user.user_type;
    const deptId = null;

    // Counts for dashboard cards
    const counts = {};
    const countQueries = [
      { key: 'publications', sql: "SELECT COUNT(*) FROM publications WHERE object_type = 'A' AND is_deleted = FALSE" },
      { key: 'projects', sql: "SELECT COUNT(*) FROM projects WHERE object_type = 'A' AND is_deleted = FALSE" },
      { key: 'events', sql: "SELECT COUNT(*) FROM events WHERE object_type = 'A' AND is_deleted = FALSE" },
      { key: 'achievements', sql: "SELECT COUNT(*) FROM achievements WHERE object_type = 'A' AND is_deleted = FALSE" },
      { key: 'visits', sql: "SELECT COUNT(*) FROM visits WHERE object_type = 'A' AND is_deleted = FALSE" },
      { key: 'studentProjects', sql: "SELECT COUNT(*) FROM student_projects WHERE object_type = 'A' AND is_deleted = FALSE" },
      { key: 'researchLabs', sql: "SELECT COUNT(*) FROM research_labs WHERE object_type = 'A' AND is_deleted = FALSE" },
    ];

    for (const q of countQueries) {
      const r = await pool.query(q.sql);
      counts[q.key] = parseInt(r.rows[0].count);
    }

    // Pending counts (for faculty advisor verification)
    let pendingCounts = {};
    if (userType === 'faculty') {
      const pendingQueries = [
        {
          key: 'publications',
          sql: `SELECT COUNT(*) FROM publications t
                JOIN users u ON u.id = t.created_by
                JOIN student_details sd ON sd.user_id = u.id
                WHERE t.object_type = 'P' AND t.is_deleted = FALSE AND u.user_type = 'student' AND sd.faculty_advisor_id = $1`
        },
        {
          key: 'projects',
          sql: `SELECT COUNT(*) FROM projects t
                JOIN users u ON u.id = t.created_by
                JOIN student_details sd ON sd.user_id = u.id
                WHERE t.object_type = 'P' AND t.is_deleted = FALSE AND u.user_type = 'student' AND sd.faculty_advisor_id = $1`
        },
        {
          key: 'events',
          sql: `SELECT COUNT(*) FROM events t
                JOIN users u ON u.id = t.created_by
                JOIN student_details sd ON sd.user_id = u.id
                WHERE t.object_type = 'P' AND t.is_deleted = FALSE AND u.user_type = 'student' AND sd.faculty_advisor_id = $1`
        },
        {
          key: 'achievements',
          sql: `SELECT COUNT(*) FROM achievements t
                JOIN users u ON u.id = t.created_by
                JOIN student_details sd ON sd.user_id = u.id
                WHERE t.object_type = 'P' AND t.is_deleted = FALSE AND u.user_type = 'student' AND sd.faculty_advisor_id = $1`
        },
        {
          key: 'visits',
          sql: `SELECT COUNT(*) FROM visits t
                JOIN users u ON u.id = t.created_by
                JOIN student_details sd ON sd.user_id = u.id
                WHERE t.object_type = 'P' AND t.is_deleted = FALSE AND u.user_type = 'student' AND sd.faculty_advisor_id = $1`
        },
        {
          key: 'studentProjects',
          sql: `SELECT COUNT(*) FROM student_projects t
                JOIN users u ON u.id = t.created_by
                JOIN student_details sd ON sd.user_id = u.id
                WHERE t.object_type = 'P' AND t.is_deleted = FALSE AND u.user_type = 'student' AND sd.faculty_advisor_id = $1`
        },
      ];
      for (const q of pendingQueries) {
        const r = await pool.query(q.sql, [userId]);
        pendingCounts[q.key] = parseInt(r.rows[0].count);
      }
    }

    // Recent items
    const recentPubs = await pool.query(
      "SELECT id, title, publication_type, created_date FROM publications WHERE object_type = 'A' AND is_deleted = FALSE ORDER BY created_date DESC LIMIT 5"
    );
    const recentEvents = await pool.query(
      "SELECT id, title, event_type, start_date FROM events WHERE object_type = 'A' AND is_deleted = FALSE ORDER BY created_date DESC LIMIT 5"
    );

    // Notification count
    const notifResult = await pool.query(
      'SELECT COUNT(*) FROM user_notifications WHERE user_id = $1 AND is_read = FALSE', [userId]
    );
    const unreadNotifications = parseInt(notifResult.rows[0].count);

    res.render('dashboard/index', {
      counts, pendingCounts, unreadNotifications,
      recentPubs: recentPubs.rows,
      recentEvents: recentEvents.rows
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    req.flash('error', 'Failed to load dashboard');
    res.render('dashboard/index', { counts: {}, pendingCounts: {}, unreadNotifications: 0, recentPubs: [], recentEvents: [] });
  }
});

module.exports = router;
