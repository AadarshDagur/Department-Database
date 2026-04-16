const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { isLoggedIn, isStaffOrAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const { paginate, paginationInfo, formatUserType } = require('../utils/helpers');

function normalizeUserType(userType) {
  const normalized = String(userType || '').trim().toLowerCase();
  if (normalized === 'staff' || normalized === 'super_admin') return 'admin';
  if (['ug_student', 'pg_student', 'phd_student'].includes(normalized)) return 'student';
  return ['admin', 'faculty', 'student'].includes(normalized) ? normalized : 'student';
}

// List all users
router.get('/', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const { limit, offset, page } = paginate(req.query.page, req.query.limit);
    const search = req.query.search || '';
    const typeFilter = req.query.type || '';
    let where = 'TRUE';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }
    if (typeFilter) {
      if (typeFilter === 'student') {
        where += ` AND u.user_type IN ('student')`;
      } else if (typeFilter === 'admin') {
        where += ` AND u.user_type = 'admin'`;
      } else {
        params.push(typeFilter);
        where += ` AND u.user_type = $${params.length}`;
      }
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM users u WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const users = await pool.query(`
      SELECT u.*
      FROM users u
      WHERE ${where}
      ORDER BY u.date_joined DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.render('users/index', {
      users: users.rows,
      pagination: paginationInfo(total, page, limit),
      query: req.query,
      formatUserType
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load users');
    res.redirect('/dashboard');
  }
});

// New user form
router.get('/new', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  
  const faculty = await pool.query("SELECT id, first_name, last_name, email FROM users WHERE is_active = TRUE AND user_type = 'faculty' ORDER BY first_name");
  const batches = await pool.query("SELECT id, degree, year FROM batches ORDER BY year DESC, degree");
  res.render('users/form', {
    user: null,
    studentDetails: null,
    
    faculty: faculty.rows,
    batches: batches.rows
  });
});

// Create user
router.post('/', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const { email, password, first_name, last_name, user_type, faculty_advisor_id, batch_id } = req.body;
    const hash = await bcrypt.hash(password || 'changeme123', 10);
    const username = email.split('@')[0] + '_' + Date.now().toString(36);
    const normalizedUserType = normalizeUserType(user_type);

    if (normalizedUserType === 'student' && !faculty_advisor_id) {
      req.flash('error', 'Faculty advisor is required for student accounts');
      return res.redirect('/users/new');
    }
    if (normalizedUserType === 'student' && !batch_id) {
      req.flash('error', 'Batch is required for student accounts');
      return res.redirect('/users/new');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, username, user_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [email, hash, first_name, last_name || '', username, normalizedUserType]
    );

      if (normalizedUserType === 'student') {
        await client.query(
          `INSERT INTO student_details (user_id, faculty_advisor_id, batch_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO UPDATE
           SET faculty_advisor_id = EXCLUDED.faculty_advisor_id,
               batch_id = EXCLUDED.batch_id`,
          [created.rows[0].id, faculty_advisor_id, batch_id]
        );
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    req.flash('success', 'User created');
    res.redirect('/users');
  } catch (err) {
    req.flash('error', 'Failed to create user: ' + err.message);
    res.redirect('/users/new');
  }
});

// Edit user form
router.get('/:id/edit', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userResult.rows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('/users');
    }

    
    const faculty = await pool.query("SELECT id, first_name, last_name, email FROM users WHERE is_active = TRUE AND user_type = 'faculty' ORDER BY first_name");
    const batches = await pool.query(`
      SELECT b.id, b.degree, b.year FROM batches b
      ORDER BY b.year DESC, b.degree, d.name
    `);

    const studentDetailsResult = await pool.query(
      'SELECT faculty_advisor_id, batch_id FROM student_details WHERE user_id = $1',
      [req.params.id]
    );

    res.render('users/form', {
      user: userResult.rows[0],
      studentDetails: studentDetailsResult.rows[0] || null,
      
      faculty: faculty.rows,
      batches: batches.rows
    });
  } catch (err) {
    req.flash('error', 'Failed to load edit form');
    res.redirect('/users');
  }
});

// Update user
router.put('/:id', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const { email, first_name, last_name, user_type, faculty_advisor_id, batch_id } = req.body;
    const normalizedUserType = normalizeUserType(user_type);

    if (normalizedUserType === 'student' && !faculty_advisor_id) {
      req.flash('error', 'Faculty advisor is required for student accounts');
      return res.redirect(`/users/${req.params.id}/edit`);
    }
    if (normalizedUserType === 'student' && !batch_id) {
      req.flash('error', 'Batch is required for student accounts');
      return res.redirect(`/users/${req.params.id}/edit`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE users
         SET email = $1,
             first_name = $2,
             last_name = $3,
             user_type = $4
         WHERE id = $5`,
        [email, first_name, last_name || '', normalizedUserType, req.params.id]
      );

      if (normalizedUserType === 'student') {
        await client.query(
          `INSERT INTO student_details (user_id, faculty_advisor_id, batch_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO UPDATE
           SET faculty_advisor_id = EXCLUDED.faculty_advisor_id,
               batch_id = EXCLUDED.batch_id`,
          [req.params.id, faculty_advisor_id, batch_id]
        );
      } else {
        await client.query('DELETE FROM student_details WHERE user_id = $1', [req.params.id]);
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    req.flash('success', 'User updated');
    res.redirect(`/users/${req.params.id}`);
  } catch (err) {
    req.flash('error', 'Failed to update user: ' + err.message);
    res.redirect(`/users/${req.params.id}/edit`);
  }
});

// Bulk CSV upload
router.get('/upload', isLoggedIn, isStaffOrAdmin, (req, res) => {
  res.render('users/upload');
});

router.post('/upload', isLoggedIn, isStaffOrAdmin, upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'No file uploaded');
      return res.redirect('/users/upload');
    }
    const csvData = fs.readFileSync(req.file.path, 'utf8');
    const records = parse(csvData, { columns: true, skip_empty_lines: true, trim: true });

    let created = 0, skipped = 0;
    const errors = [];
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // Header is row 1
      const email = row.email || row.Email;
      if (!email) { skipped++; errors.push(`Row ${rowNum}: Missing email`); continue; }
      const password = (row.password || row.Password || '').toString();
      if (!password || password.length < 6) {
        skipped++;
        errors.push(`Row ${rowNum}: Missing password or password too short (min 6)`);
        continue;
      }
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) { skipped++; errors.push(`Row ${rowNum}: Email already exists (${email})`); continue; }

      const hash = await bcrypt.hash(password, 10);

      const username = email.split('@')[0] + '_' + Date.now().toString(36);
      const userType = 'student';

      const deptCodeRaw = row.department || row.department_code || row.dept || '';
      

      let advisorId = null;
      if (row.faculty_advisor_id) {
        advisorId = Number(row.faculty_advisor_id) || null;
      } else if (row.faculty_advisor_email) {
        const advisorLookup = await pool.query(
          "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND user_type = 'faculty'",
          [String(row.faculty_advisor_email).trim()]
        );
        advisorId = advisorLookup.rows[0] ? advisorLookup.rows[0].id : null;
      }

      let batchId = null;
      if (row.batch_id) {
        batchId = Number(row.batch_id) || null;
      } else if (row.batch_year && departmentId) {
        const rawDegree = String(row.batch_degree || row.degree || '').trim();
        if (rawDegree) {
          const batchLookup = await pool.query(
            'SELECT id FROM batches WHERE year = $1 AND degree = $2',
            [Number(row.batch_year), rawDegree]
          );
          batchId = batchLookup.rows[0] ? batchLookup.rows[0].id : null;
        } else {
          const batchLookup = await pool.query(
            'SELECT id FROM batches WHERE year = $1 ORDER BY degree LIMIT 1',
            [Number(row.batch_year)]
          );
          batchId = batchLookup.rows[0] ? batchLookup.rows[0].id : null;
        }
      }

      if (!advisorId) {
        skipped++;
        errors.push(`Row ${rowNum}: Student requires faculty_advisor_id or faculty_advisor_email`);
        continue;
      }
      if (!batchId) {
        skipped++;
        errors.push(`Row ${rowNum}: Student requires batch_id or batch_year (with valid department code; add batch_degree if multiple batches exist)`);
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const inserted = await client.query(
          `INSERT INTO users (email, password_hash, first_name, last_name, username, user_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [email, hash, row.first_name || row.name || '', row.last_name || '', username, userType, departmentId]
        );

        await client.query(
          `INSERT INTO student_details (user_id, faculty_advisor_id, batch_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO UPDATE
           SET faculty_advisor_id = EXCLUDED.faculty_advisor_id,
               batch_id = EXCLUDED.batch_id`,
          [inserted.rows[0].id, advisorId, batchId]
        );

        await client.query('COMMIT');
        created++;
      } catch (rowErr) {
        await client.query('ROLLBACK');
        skipped++;
        errors.push(`Row ${rowNum}: ${rowErr.message}`);
      } finally {
        client.release();
      }
    }
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    if (errors.length > 0) {
      req.flash('info', `Import notes: ${errors.slice(0, 5).join(' | ')}${errors.length > 5 ? ' ...' : ''}`);
    }
    req.flash('success', `Created ${created} users. Skipped ${skipped}.`);
    res.redirect('/users');
  } catch (err) {
    console.error(err);
    req.flash('error', 'CSV upload failed: ' + err.message);
    res.redirect('/users/upload');
  }
});

// Toggle active status
router.put('/:id/toggle', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active = NOT is_active WHERE id = $1', [req.params.id]);
    req.flash('success', 'User status updated');
    res.redirect('/users');
  } catch (err) {
    req.flash('error', 'Failed to update user');
    res.redirect('/users');
  }
});

// View user detail
router.get('/:id', isLoggedIn, isStaffOrAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*
      FROM users u
      WHERE u.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) { req.flash('error', 'User not found'); return res.redirect('/users'); }
    
    let details = null;
    const user = result.rows[0];
    if (user.user_type === 'student') {
      const detailsResult = await pool.query(`
        SELECT sd.*, 
               u2.first_name as advisor_first_name, u2.last_name as advisor_last_name
        FROM student_details sd
        LEFT JOIN users u2 ON sd.faculty_advisor_id = u2.id
        WHERE sd.user_id = $1
      `, [user.id]);
      if (detailsResult.rows.length > 0) {
        details = detailsResult.rows[0];
        if (details.advisor_first_name) {
          details.faculty_advisor = `${details.advisor_first_name} ${details.advisor_last_name}`;
        }
        delete details.advisor_first_name;
        delete details.advisor_last_name;
        delete details.faculty_advisor_id;
      }
    }

    res.render('users/show', { user, details, formatUserType }); 
  } catch (err) {
    req.flash('error', 'Failed to load user');
    res.redirect('/users');
  }
});

module.exports = router;
