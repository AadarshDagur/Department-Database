const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isLoggedIn, isStaffOrAdmin } = require('../middleware/auth');
const { createCrudRoutes } = require('../utils/crud');

const crud = createCrudRoutes({
  tableName: 'research_labs',
  displayName: 'Research Lab',
  memberTable: null,
  memberFk: null,
  
  
  fields: ['name', 'description', 'lab_type', 'code', 'head_id', 'equipment', 'website', 'address'],
  typeField: 'lab_type',
  typeChoices: ['UG Lab', 'PG Lab', 'Research Lab']
});

router.get('/', async (req, res) => {
  const { items, pagination } = await crud.listApproved(req);
  for (const item of items) {
    if (item.head_id) {
      const h = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [item.head_id]);
      item.head_name = h.rows[0] ? `${h.rows[0].first_name} ${h.rows[0].last_name}` : '';
    }
  }
  res.render('research-labs/index', { items, pagination, query: req.query });
});

router.get('/new', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  
  const faculty = await pool.query("SELECT id, first_name, last_name FROM users WHERE is_active = TRUE AND user_type = 'faculty' ORDER BY first_name");
  res.render('research-labs/form', { item: null,  faculty: faculty.rows, typeChoices: ['UG Lab', 'PG Lab', 'Research Lab'] });
});

router.post('/', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    // Map 'name' field (research_labs use 'name' not 'title')
    const id = await crud.createItem(req.body, req.session.user.id, false, req.session.user.user_type);
    req.flash('success', 'Research lab created');
    res.redirect(`/research-labs/${id}`);
  } catch (err) { console.error(err); req.flash('error', 'Failed to create'); res.redirect('/research-labs/new'); }
});

router.get('/:id', async (req, res) => {
  const item = await crud.getById(req.params.id);
  if (!item) { req.flash('error', 'Not found'); return res.redirect('/research-labs'); }
  if (item.head_id) {
    const h = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [item.head_id]);
    item.head_name = h.rows[0] ? `${h.rows[0].first_name} ${h.rows[0].last_name}` : '';
  }
  res.render('research-labs/show', { item });
});

router.get('/:id/edit', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  const item = await crud.getById(req.params.id);
  if (!item) { req.flash('error', 'Not found'); return res.redirect('/research-labs'); }
  
  const faculty = await pool.query("SELECT id, first_name, last_name FROM users WHERE is_active = TRUE AND user_type = 'faculty' ORDER BY first_name");
  res.render('research-labs/form', { item,  faculty: faculty.rows, typeChoices: ['UG Lab', 'PG Lab', 'Research Lab'] });
});

router.put('/:id', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  await crud.updateItem(req.params.id, req.body, req.session.user.id, req.session.user.user_type);
  req.flash('success', 'Updated');
  res.redirect(`/research-labs/${req.params.id}`);
});

router.delete('/:id', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  await crud.softDelete(req.params.id, req.session.user.id);
  req.flash('success', 'Deleted');
  res.redirect('/research-labs');
});

module.exports = router;
