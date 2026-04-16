const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isLoggedIn, isStaffOrAdmin } = require('../middleware/auth');

// Reports page
router.get('/', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  res.render('reports/index', { reportData: null });
});

// Generate BoG report data
router.get('/bog', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    const dateParams = [];
    let dateFilter = '';
    if (from_date) { dateParams.push(from_date); dateFilter += ` AND created_date >= $${dateParams.length}`; }
    if (to_date) { dateParams.push(to_date); dateFilter += ` AND created_date <= $${dateParams.length}`; }

    const baseWhere = `object_type = 'A' AND is_deleted = FALSE${dateFilter}`;  

    // Faculty achievements
    const achievements = await pool.query(
      `SELECT a.*, u.first_name || ' ' || u.last_name as creator_name
       FROM achievements a LEFT JOIN users u ON a.created_by = u.id
       WHERE ${baseWhere} ORDER BY a.created_date DESC`,
      dateParams
    );

    // Events
    const events = await pool.query(
      `SELECT e.*, u.first_name || ' ' || u.last_name as creator_name
       FROM events e LEFT JOIN users u ON e.created_by = u.id
       WHERE ${baseWhere} ORDER BY e.created_date DESC`,
      dateParams
    );

    // Visits
    const visits = await pool.query(
      `SELECT v.*, u.first_name || ' ' || u.last_name as creator_name
       FROM visits v LEFT JOIN users u ON v.created_by = u.id
       WHERE ${baseWhere} ORDER BY v.created_date DESC`,
      dateParams
    );

    // Publications
    const publications = await pool.query(
      `SELECT p.*, u.first_name || ' ' || u.last_name as creator_name
       FROM publications p LEFT JOIN users u ON p.created_by = u.id
       WHERE ${baseWhere} ORDER BY p.created_date DESC`,
      dateParams
    );

    // Projects
    const projects = await pool.query(
      `SELECT p.*, u.first_name || ' ' || u.last_name as creator_name
       FROM projects p LEFT JOIN users u ON p.created_by = u.id
       WHERE ${baseWhere} ORDER BY p.created_date DESC`,
      dateParams
    );

    res.render('reports/index', {
      reportData: {
        type: 'BoG',
        query: req.query,
        achievements: achievements.rows,
        events: events.rows,
        visits: visits.rows,
        publications: publications.rows,
        projects: projects.rows
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to generate report');
    res.redirect('/reports');
  }
});

module.exports = router;
