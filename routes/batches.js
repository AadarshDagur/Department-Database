const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isLoggedIn, isStaffOrAdmin } = require('../middleware/auth');

router.get('/', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*,
             COALESCE((
               SELECT COUNT(*)
               FROM student_details sd
               WHERE sd.batch_id = b.id
             ), 0)::int AS student_count
      FROM batches b
      ORDER BY b.year DESC, b.degree
    `);
    res.render('batches/index', { batches: result.rows, items: result.rows });
  } catch (err) {
    req.flash('error', 'Failed to load batches');
    res.redirect('/dashboard');
  }
});

router.get('/new', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  res.render('batches/form', { batch: null });
});

router.post('/', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const { degree, year } = req.body;
    await pool.query('INSERT INTO batches (degree, year) VALUES ($1, $2)', [degree || 'UG', year]);
    req.flash('success', 'Batch created');
    res.redirect('/batches');
  } catch (err) {
    req.flash('error', 'Failed to create batch: ' + err.message);
    res.redirect('/batches/new');
  }
});

router.get('/:id', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const batchRes = await pool.query(`
      SELECT b.*
      FROM batches b
      WHERE b.id = $1
    `, [req.params.id]);

    if (batchRes.rows.length === 0) {
      req.flash('error', 'Batch not found');
      return res.redirect('/batches');
    }

    const studentsRes = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.profile_image,
             sd.entry_number, sd.degree
      FROM student_details sd
      JOIN users u ON u.id = sd.user_id
      WHERE sd.batch_id = $1 AND u.is_active = TRUE
      ORDER BY sd.entry_number
    `, [req.params.id]);

    res.render('batches/show', {
      batch: batchRes.rows[0],
      students: studentsRes.rows
    });
  } catch (err) {
    req.flash('error', 'Failed to load batch details');
    res.redirect('/batches');
  }
});

router.get('/:id/edit', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const batch = await pool.query('SELECT * FROM batches WHERE id = $1', [req.params.id]);
    if (batch.rows.length === 0) { req.flash('error', 'Not found'); return res.redirect('/batches'); }

    res.render('batches/form', { batch: batch.rows[0] });
  } catch (err) {
    req.flash('error', 'Failed to load batch');
    res.redirect('/batches');
  }
});

router.put('/:id', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const { degree, year } = req.body;
    await pool.query('UPDATE batches SET degree = $1, year = $2 WHERE id = $3', [degree || 'UG', year, req.params.id]);
    req.flash('success', 'Batch updated');
    res.redirect('/batches');
  } catch (err) {
    req.flash('error', 'Failed to update batch: ' + err.message);
    res.redirect(`/batches/${req.params.id}/edit`);
  }
});

router.delete('/:id', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM batches WHERE id = $1', [req.params.id]);
    req.flash('success', 'Batch deleted');
    res.redirect('/batches');
  } catch (err) {
    req.flash('error', 'Failed to delete batch');
    res.redirect('/batches');
  }
});

module.exports = router;
