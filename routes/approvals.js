const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isLoggedIn, isFaculty } = require('../middleware/auth');

const modules = [
  { key: 'publications', label: 'Publications', path: '/publications', table: 'publications', titleField: 'title' },
  { key: 'projects', label: 'Projects', path: '/projects', table: 'projects', titleField: 'title' },
  { key: 'events', label: 'Events', path: '/events', table: 'events', titleField: 'title' },
  { key: 'achievements', label: 'Achievements', path: '/achievements', table: 'achievements', titleField: 'title' },
  { key: 'visits', label: 'Visits', path: '/visits', table: 'visits', titleField: 'title' },
  { key: 'studentProjects', label: 'Student Projects', path: '/student-projects', table: 'student_projects', titleField: 'title' }
];

router.get('/', isLoggedIn, isFaculty, async (req, res) => {
  try {
    const advisorId = req.session.user.id;
    const sections = [];
    let totalPending = 0;

    for (const mod of modules) {
      const countResult = await pool.query(
        `SELECT COUNT(*)
         FROM ${mod.table} t
         JOIN users u ON u.id = t.created_by
         JOIN student_details sd ON sd.user_id = u.id
         WHERE t.object_type = 'P' AND t.is_deleted = FALSE
           AND u.user_type = 'student'
           AND sd.faculty_advisor_id = $1`,
        [advisorId]
      );
      const count = parseInt(countResult.rows[0].count, 10);
      totalPending += count;

      const itemsResult = await pool.query(
        `SELECT t.id, t.${mod.titleField} AS title, t.created_date,
                u.first_name || ' ' || u.last_name AS creator_name
         FROM ${mod.table} t
         JOIN users u ON t.created_by = u.id
         JOIN student_details sd ON sd.user_id = u.id
         WHERE t.object_type = 'P' AND t.is_deleted = FALSE
           AND u.user_type = 'student'
           AND sd.faculty_advisor_id = $1
         ORDER BY t.created_date DESC
         LIMIT 25`,
        [advisorId]
      );

      sections.push({
        ...mod,
        count,
        items: itemsResult.rows
      });
    }

    res.render('approvals/index', { sections, totalPending });
  } catch (err) {
    console.error('Approvals page error:', err);
    req.flash('error', 'Failed to load approvals');
    res.redirect('/dashboard');
  }
});

module.exports = router;
