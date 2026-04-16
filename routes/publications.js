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
  tableName: 'publications',
  displayName: 'Publication',
  memberTable: 'publication_authors',
  memberFk: 'publication_id',
  
  
  fields: ['title', 'description', 'publication_type', 'status', 'doi', 'isbn', 'issn', 'corpus_id',
    'journal_name', 'publisher', 'volume', 'pages', 'year', 'month', 'url', 'published_date', 'accepted_date'],
  typeField: 'publication_type',
  typeChoices: ['Journal', 'Conference', 'Book', 'Book Chapter', 'Patent']
});

// List approved publications
router.get('/', async (req, res) => {
  try {
    const { items, pagination } = await crud.listApproved(req);
    
    res.render('publications/index', { items, pagination, query: req.query,  });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load publications');
    res.redirect('/dashboard');
  }
});

// My publications
router.get('/my', isLoggedIn, async (req, res) => {
  try {
    const { items, pagination } = await crud.listUserItems(req, 'approved');
    res.render('publications/my', { items, pagination, tab: 'active' });
  } catch (err) {
    req.flash('error', 'Failed to load your publications');
    res.redirect('/publications');
  }
});

// Drafts
router.get('/drafts', isLoggedIn, async (req, res) => {
  try {
    const { items, pagination } = await crud.listUserItems(req, 'DR');
    res.render('publications/my', { items, pagination, tab: 'drafts' });
  } catch (err) {
    req.flash('error', 'Failed to load drafts');
    res.redirect('/publications');
  }
});

// Pending approval
router.get('/pending', isLoggedIn, async (req, res) => {
  try {
    const { items, pagination } = await crud.listUserItems(req, 'P');
    res.render('publications/my', { items, pagination, tab: 'pending' });
  } catch (err) {
    req.flash('error', 'Failed to load pending');
    res.redirect('/publications');
  }
});

// Deleted
router.get('/deleted', isLoggedIn, async (req, res) => {
  try {
    const { items, pagination } = await crud.listUserItems(req, 'deleted');
    res.render('publications/my', { items, pagination, tab: 'deleted' });
  } catch (err) {
    req.flash('error', 'Failed to load deleted');
    res.redirect('/publications');
  }
});

// New form
router.get('/new', isLoggedIn, async (req, res) => {
  
  const users = await pool.query("SELECT id, first_name, last_name, email FROM users WHERE is_active = TRUE AND user_type IN ('faculty','student') ORDER BY first_name");
  res.render('publications/form', {
    item: null,
    
    users: users.rows,
    typeChoices: ['Journal', 'Conference', 'Book', 'Book Chapter', 'Patent'],
    statusChoices: ['Published', 'Submitted', 'Accepted', 'Rejected']
  });
});

// Create
router.post('/', isLoggedIn, async (req, res) => {
  try {
    const isDraft = req.body.save_as === 'draft' || req.body.is_draft === 'true' || req.body.is_draft === true;
    const id = await crud.createItem(req.body, req.session.user.id, isDraft, req.session.user.user_type);
    req.flash('success', isDraft ? 'Draft saved' : 'Publication created');
    res.redirect(`/publications/${id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to create publication');
    res.redirect('/publications/new');
  }
});

// Show
router.get('/:id', async (req, res) => {
  try {
    const item = await crud.getById(req.params.id);
    if (!item) {
      req.flash('error', 'Publication not found');
      return res.redirect('/publications');
    }
    res.render('publications/show', { item });
  } catch (err) {
    req.flash('error', 'Failed to load publication');
    res.redirect('/publications');
  }
});

// Edit form
router.get('/:id/edit', isLoggedIn, async (req, res) => {
  try {
    const item = await crud.getById(req.params.id);
    if (!item) { req.flash('error', 'Not found'); return res.redirect('/publications'); }
    if (item.created_by !== req.session.user.id && !['admin'].includes(req.session.user.user_type)) {
      req.flash('error', 'Not authorized');
      return res.redirect(`/publications/${req.params.id}`);
    }
    
    const users = await pool.query("SELECT id, first_name, last_name, email FROM users WHERE is_active = TRUE AND user_type IN ('faculty','student') ORDER BY first_name");
    res.render('publications/form', {
      item,
      
      users: users.rows,
      typeChoices: ['Journal', 'Conference', 'Book', 'Book Chapter', 'Patent'],
      statusChoices: ['Published', 'Submitted', 'Accepted', 'Rejected']
    });
  } catch (err) {
    req.flash('error', 'Failed to load form');
    res.redirect('/publications');
  }
});

// Update
router.put('/:id', isLoggedIn, async (req, res) => {
  try {
    await crud.updateItem(req.params.id, req.body, req.session.user.id, req.session.user.user_type);
    req.flash('success', 'Publication updated');
    res.redirect(`/publications/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update');
    res.redirect(`/publications/${req.params.id}/edit`);
  }
});

// Delete
router.delete('/:id', isLoggedIn, async (req, res) => {
  try {
    await crud.softDelete(req.params.id, req.session.user.id);
    req.flash('success', 'Publication deleted');
    res.redirect('/publications');
  } catch (err) {
    req.flash('error', 'Failed to delete');
    res.redirect(`/publications/${req.params.id}`);
  }
});

// Restore
router.put('/:id/restore', isLoggedIn, async (req, res) => {
  try {
    await crud.restore(req.params.id);
    req.flash('success', 'Publication restored');
    res.redirect(`/publications/${req.params.id}`);
  } catch (err) {
    req.flash('error', 'Failed to restore');
    res.redirect('/publications/deleted');
  }
});

// Submit for approval
router.put('/:id/submit', isLoggedIn, async (req, res) => {
  try {
    await crud.submitForApproval(req.params.id);
    req.flash('success', 'Submitted for approval');
    res.redirect(`/publications/${req.params.id}`);
  } catch (err) {
    req.flash('error', 'Failed to submit');
    res.redirect(`/publications/${req.params.id}`);
  }
});

// Approve
router.put('/:id/approve', isLoggedIn, isFaculty, async (req, res) => {
  try {
    await crud.approve(req.params.id, req.session.user.id, req.session.user.user_type);
    req.flash('success', 'Publication approved');
    res.redirect('/publications/pending');
  } catch (err) {
    req.flash('error', err.message || 'Failed to approve');
    res.redirect('/publications/pending');
  }
});

// Reject
router.put('/:id/reject', isLoggedIn, isFaculty, async (req, res) => {
  try {
    await crud.reject(req.params.id, req.session.user.id, req.session.user.user_type);
    req.flash('success', 'Publication rejected');
    res.redirect('/publications/pending');
  } catch (err) {
    req.flash('error', err.message || 'Failed to reject');
    res.redirect('/publications/pending');
  }
});

// CSV Upload
router.post('/csv-upload', isLoggedIn, (req, res) => {
  csvUpload(req, res, async (err) => {
    if (err) { req.flash('error', err.message); return res.redirect('/publications'); }
    if (!req.file) { req.flash('error', 'Please select a CSV file'); return res.redirect('/publications'); }
    try {
      const result = await processCSV(req.file.buffer, ['title', 'description', 'publication_type', 'status', 'doi', 'isbn', 'issn', 'corpus_id', 'journal_name', 'publisher', 'volume', 'pages', 'year', 'month', 'url', 'published_date', 'accepted_date'], crud, req.session.user.id, req.session.user.user_type);
      if (result.errors.length > 0) {
        req.flash('error', `Imported ${result.success} of ${result.total} rows. ${result.errors.length} errors: ${result.errors.slice(0,3).map(e => `Row ${e.row}: ${e.message}`).join('; ')}`);
      } else {
        req.flash('success', `Successfully imported ${result.success} publications from CSV`);
      }
    } catch (e) {
      console.error(e);
      req.flash('error', 'Failed to process CSV: ' + e.message);
    }
    res.redirect('/publications');
  });
});

module.exports = router;
