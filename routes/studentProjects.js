const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isLoggedIn, isFaculty } = require('../middleware/auth');
const { createCrudRoutes } = require('../utils/crud');
const multer = require('multer');
const { processCSV } = require('../utils/csvParser');

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) cb(null, true);
  else cb(new Error('Only CSV files are allowed'));
}}).single('csvFile');

const crud = createCrudRoutes({
  tableName: 'student_projects',
  displayName: 'Student Project',
  memberTable: 'student_project_members',
  memberFk: 'student_project_id',
  
  
  fields: ['title', 'description', 'status', 'mentor_id', 'start_date', 'end_date', 'url'],
  typeField: 'status',
  typeChoices: ['Ongoing', 'Completed', 'Cancelled']
});

router.get('/', async (req, res) => {
  const { items, pagination } = await crud.listApproved(req);
  // Get mentor names
  for (const item of items) {
    if (item.mentor_id) {
      const m = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [item.mentor_id]);
      item.mentor_name = m.rows[0] ? `${m.rows[0].first_name} ${m.rows[0].last_name}` : '';
    }
  }
  res.render('student-projects/index', { items, pagination, query: req.query });
});

router.get('/my', isLoggedIn, async (req, res) => {
  const { items, pagination } = await crud.listUserItems(req, 'approved');
  res.render('student-projects/my', { items, pagination, tab: 'active' });
});

router.get('/drafts', isLoggedIn, async (req, res) => {
  const { items, pagination } = await crud.listUserItems(req, 'DR');
  res.render('student-projects/my', { items, pagination, tab: 'drafts' });
});

router.get('/pending', isLoggedIn, async (req, res) => {
  const { items, pagination } = await crud.listUserItems(req, 'P');
  res.render('student-projects/my', { items, pagination, tab: 'pending' });
});

router.get('/deleted', isLoggedIn, async (req, res) => {
  const { items, pagination } = await crud.listUserItems(req, 'deleted');
  res.render('student-projects/my', { items, pagination, tab: 'deleted' });
});

// CSV Upload
router.post('/csv-upload', isLoggedIn, (req, res) => {
  csvUpload(req, res, async (err) => {
    if (err) { req.flash('error', err.message); return res.redirect('/student-projects'); }
    if (!req.file) { req.flash('error', 'Please select a CSV file'); return res.redirect('/student-projects'); }
    try {
      const result = await processCSV(req.file.buffer, ['title', 'description', 'status', 'start_date', 'end_date', 'url'], crud, req.session.user.id, req.session.user.user_type);
      if (result.errors.length > 0) {
        req.flash('error', `Imported ${result.success} of ${result.total} rows. ${result.errors.length} errors: ${result.errors.slice(0,3).map(e => `Row ${e.row}: ${e.message}`).join('; ')}`);
      } else {
        req.flash('success', `Successfully imported ${result.success} student projects from CSV`);
      }
    } catch (e) { console.error(e); req.flash('error', 'Failed to process CSV: ' + e.message); }
    res.redirect('/student-projects');
  });
});

router.get('/new', isLoggedIn, async (req, res) => {
  
  const faculty = await pool.query("SELECT id, first_name, last_name FROM users WHERE is_active = TRUE AND user_type = 'faculty' ORDER BY first_name");
  const students = await pool.query("SELECT id, first_name, last_name, email FROM users WHERE is_active = TRUE AND user_type IN ('student') ORDER BY first_name");
  res.render('student-projects/form', { item: null,  faculty: faculty.rows, students: students.rows, statusChoices: ['Ongoing', 'Completed', 'Cancelled'] });
});

router.post('/', isLoggedIn, async (req, res) => {
  try {
    const isDraft = req.body.save_as === 'draft' || req.body.is_draft === 'true' || req.body.is_draft === true;
    const id = await crud.createItem(req.body, req.session.user.id, isDraft, req.session.user.user_type);
    req.flash('success', isDraft ? 'Draft saved' : 'Student project created');
    res.redirect(`/student-projects/${id}`);
  } catch (err) { console.error(err); req.flash('error', 'Failed to create'); res.redirect('/student-projects/new'); }
});

router.get('/:id', async (req, res) => {
  const item = await crud.getById(req.params.id);
  if (!item) { req.flash('error', 'Not found'); return res.redirect('/student-projects'); }
  if (item.mentor_id) {
    const m = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [item.mentor_id]);
    item.mentor_name = m.rows[0] ? `${m.rows[0].first_name} ${m.rows[0].last_name}` : '';
  }
  res.render('student-projects/show', { item });
});

router.get('/:id/edit', isLoggedIn, async (req, res) => {
  const item = await crud.getById(req.params.id);
  if (!item) { req.flash('error', 'Not found'); return res.redirect('/student-projects'); }
  
  const faculty = await pool.query("SELECT id, first_name, last_name FROM users WHERE is_active = TRUE AND user_type = 'faculty' ORDER BY first_name");
  const students = await pool.query("SELECT id, first_name, last_name, email FROM users WHERE is_active = TRUE AND user_type IN ('student') ORDER BY first_name");
  res.render('student-projects/form', { item,  faculty: faculty.rows, students: students.rows, statusChoices: ['Ongoing', 'Completed', 'Cancelled'] });
});

router.put('/:id', isLoggedIn, async (req, res) => {
  await crud.updateItem(req.params.id, req.body, req.session.user.id, req.session.user.user_type);
  req.flash('success', 'Updated');
  res.redirect(`/student-projects/${req.params.id}`);
});

router.delete('/:id', isLoggedIn, async (req, res) => {
  await crud.softDelete(req.params.id, req.session.user.id);
  req.flash('success', 'Deleted');
  res.redirect('/student-projects');
});

router.put('/:id/restore', isLoggedIn, async (req, res) => { await crud.restore(req.params.id); req.flash('success', 'Restored'); res.redirect(`/student-projects/${req.params.id}`); });
router.put('/:id/submit', isLoggedIn, async (req, res) => { await crud.submitForApproval(req.params.id); req.flash('success', 'Submitted'); res.redirect(`/student-projects/${req.params.id}`); });
router.put('/:id/approve', isLoggedIn, isFaculty, async (req, res) => {
  try {
    await crud.approve(req.params.id, req.session.user.id, req.session.user.user_type);
    req.flash('success', 'Approved');
  } catch (err) {
    req.flash('error', err.message || 'Failed to approve');
  }
  res.redirect('/student-projects/pending');
});
router.put('/:id/reject', isLoggedIn, isFaculty, async (req, res) => {
  try {
    await crud.reject(req.params.id, req.session.user.id, req.session.user.user_type);
    req.flash('success', 'Rejected');
  } catch (err) {
    req.flash('error', err.message || 'Failed to reject');
  }
  res.redirect('/student-projects/pending');
});

module.exports = router;
