const pool = require('../config/database');
const { paginate, paginationInfo, generateTexts } = require('./helpers');

function isAdminUserType(userType) {
  return userType === 'admin';
}

function isFacultyUserType(userType) {
  return userType === 'faculty';
}

function isStudentUserType(userType) {
  return userType === 'student';
}

function resolveItemLabelField(fields) {
  if (fields.includes('title')) return 'title';
  if (fields.includes('name')) return 'name';
  return null;
}

// Generic CRUD factory for BaseModel tables
function createCrudRoutes({ tableName, displayName, memberTable, memberFk, fields, typeField, typeChoices }) {
  const itemLabelField = resolveItemLabelField(fields);

  async function createDecisionNotification(itemId, approverId, decision) {
    const labelSelect = itemLabelField ? `, ${itemLabelField} AS item_label` : '';
    const itemResult = await pool.query(
      `SELECT created_by${labelSelect} FROM ${tableName} WHERE id = $1`,
      [itemId]
    );
    if (itemResult.rows.length === 0) return;

    const item = itemResult.rows[0];
    const creatorId = item.created_by;
    if (!creatorId) return;

    const approverResult = await pool.query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [approverId]
    );
    const approverName = approverResult.rows.length > 0
      ? `${approverResult.rows[0].first_name} ${approverResult.rows[0].last_name}`
      : 'Your faculty advisor';

    const normalizedDecision = decision === 'approved' ? 'approved' : 'rejected';
    const title = `${displayName} ${normalizedDecision === 'approved' ? 'Approved' : 'Rejected'}`;
    const itemLabel = item.item_label ? ` "${item.item_label}"` : '';
    const message = `Your ${displayName.toLowerCase()}${itemLabel} was ${normalizedDecision} by ${approverName}.`;

    await pool.query(
      `INSERT INTO user_notifications (user_id, title, message)
       VALUES ($1, $2, $3)`,
      [creatorId, title, message]
    );
  }


  async function listApproved(req) {
    const { limit, offset, page } = paginate(req.query.page, req.query.limit);
    const search = req.query.search || '';
    let where = `${tableName}.object_type = 'A' AND ${tableName}.is_deleted = FALSE`;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      const searchCol = fields.includes('title') ? 'title' : fields[0];
      where += ` AND ${tableName}.${searchCol} ILIKE $${params.length}`;
    }
    if (req.query.type) {
      params.push(req.query.type);
      where += ` AND ${tableName}.${typeField} = $${params.length}`;
    }
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName} WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);
    params.push(limit, offset);
    const items = await pool.query(
      `SELECT ${tableName}.*, u.first_name || ' ' || u.last_name as creator_name
       FROM ${tableName}
       LEFT JOIN users u ON ${tableName}.created_by = u.id
       WHERE ${where}
       ORDER BY ${tableName}.created_date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params
    );
    return { items: items.rows, pagination: paginationInfo(total, page, limit) };
  }

  async function listUserItems(req, objectType) {
    const userId = req.session.user.id;
    const userType = req.session.user.user_type;
    const { limit, offset, page } = paginate(req.query.page);
    let where, params;
    if (objectType === 'DR') {
      where = `${tableName}.is_draft = TRUE AND ${tableName}.created_by = $1 AND ${tableName}.is_deleted = FALSE`;
    } else if (objectType === 'P') {
      if (isFacultyUserType(userType)) {
        where = `${tableName}.object_type = 'P' AND ${tableName}.is_deleted = FALSE AND EXISTS (
          SELECT 1
          FROM student_details sd
          JOIN users su ON su.id = sd.user_id
          WHERE sd.faculty_advisor_id = $1
            AND su.user_type = 'student'
            AND su.id = ${tableName}.created_by
        )`;
        params = [userId];
      } else if (isStudentUserType(userType)) {
        where = `${tableName}.object_type = 'P' AND ${tableName}.is_deleted = FALSE AND ${tableName}.created_by = $1`;
        params = [userId];
      } else {
        where = 'FALSE';
        params = [];
      }
    } else if (objectType === 'deleted') {
      where = `${tableName}.is_deleted = TRUE AND ${tableName}.deleted_by = $1`;
    } else {
      where = `${tableName}.object_type = 'A' AND ${tableName}.created_by = $1 AND ${tableName}.is_deleted = FALSE`;
    }
    if (!params) {
      params = [userId];
    }
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName} WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);
    params.push(limit, offset);
    const limIdx = params.length - 1;
    const offIdx = params.length;
    const items = await pool.query(
      `SELECT ${tableName}.*, u.first_name || ' ' || u.last_name as creator_name
       FROM ${tableName}
       LEFT JOIN users u ON ${tableName}.created_by = u.id
       WHERE ${where}
       ORDER BY ${tableName}.created_date DESC
       LIMIT $${limIdx} OFFSET $${offIdx}`, params
    );
    return { items: items.rows, pagination: paginationInfo(total, page, limit) };
  }

  async function getById(id) {
    const result = await pool.query(
      `SELECT ${tableName}.*, u.first_name || ' ' || u.last_name as creator_name, u.email as creator_email
       FROM ${tableName}
       LEFT JOIN users u ON ${tableName}.created_by = u.id
       WHERE ${tableName}.id = $1`, [id]
    );
    if (result.rows.length === 0) return null;
    const item = result.rows[0];

    // Get members/authors
    if (memberTable) {
      const members = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.user_type
         FROM ${memberTable} m JOIN users u ON m.user_id = u.id
         WHERE m.${memberFk} = $1`, [id]
      );
      item.members = members.rows;
    }

    return item;
  }

  async function createItem(data, userId, isDraft = false, userType = null) {
    const wantsDraft = isDraft || data.save_as === 'draft' || data.is_draft === true || data.is_draft === 'true' || data.is_draft === '1';
    const objectType = wantsDraft ? 'DR' : (isStudentUserType(userType) ? 'P' : 'A');
    const cols = ['created_by', 'is_draft', 'object_type'];
    const vals = [userId, wantsDraft, objectType];
    let idx = 4;
    
    for (const field of fields) {
      if (data[field] !== undefined && data[field] !== '') {
        cols.push(field);
        vals.push(data[field]);
        idx++;
      }
    }

    // Generate texts from members
    let memberIds = [];
    if (data.members) {
      memberIds = Array.isArray(data.members) ? data.members.map(Number) : [Number(data.members)];
      const texts = await generateTexts(memberIds);
      cols.push('users_text', 'tags_text');
      vals.push(texts.users_text, texts.tags_text);
    }

    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query(
      `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      vals
    );
    const itemId = result.rows[0].id;

    // Add members
    if (memberTable && memberIds.length > 0) {
      for (const mId of memberIds) {
        await pool.query(`INSERT INTO ${memberTable} (${memberFk}, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [itemId, mId]);
      }
    }

    return itemId;
  }

  async function updateItem(id, data, userId, userType = null) {
    const sets = [];
    const vals = [];
    let idx = 1;

    // Student edits always go back to pending advisor approval.
    if (isStudentUserType(userType)) {
      sets.push(`is_draft = FALSE`, `object_type = 'P'`);
    } else if (isFacultyUserType(userType) || isAdminUserType(userType)) {
      sets.push(`is_draft = FALSE`, `object_type = 'A'`);
    }

    for (const field of fields) {
      if (data[field] !== undefined) {
        sets.push(`${field} = $${idx}`);
        vals.push(data[field] === '' ? null : data[field]);
        idx++;
      }
    }

    // Regenerate texts
    if (data.members !== undefined) {
      const rawMemberIds = Array.isArray(data.members)
        ? data.members
        : (data.members === '' || data.members === null ? [] : [data.members]);
      const memberIds = rawMemberIds
        .map(Number)
        .filter((memberId) => Number.isInteger(memberId) && memberId > 0);
      const texts = await generateTexts(memberIds);
      sets.push(`users_text = $${idx}`, `tags_text = $${idx + 1}`);
      vals.push(texts.users_text, texts.tags_text);
      idx += 2;

      // Update members
      if (memberTable) {
        await pool.query(`DELETE FROM ${memberTable} WHERE ${memberFk} = $1`, [id]);
        for (const mId of memberIds) {
          await pool.query(`INSERT INTO ${memberTable} (${memberFk}, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, mId]);
        }
      }
    }

    if (sets.length > 0) {
      vals.push(id);
      await pool.query(`UPDATE ${tableName} SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    }
  }

  async function softDelete(id, userId) {
    await pool.query(
      `UPDATE ${tableName} SET is_deleted = TRUE, deleted_by = $1, deleted_at = NOW() WHERE id = $2`,
      [userId, id]
    );
  }

  async function restore(id) {
    await pool.query(
      `UPDATE ${tableName} SET is_deleted = FALSE, deleted_by = NULL, deleted_at = NULL WHERE id = $1`,
      [id]
    );
  }

  async function submitForApproval(id) {
    await pool.query(
      `UPDATE ${tableName} SET is_draft = FALSE, object_type = 'P' WHERE id = $1`, [id]
    );
  }

  async function approve(id, approverId, approverType) {
    if (!isFacultyUserType(approverType)) {
      throw new Error('Only faculty advisors can approve student submissions');
    }

    const allowed = await pool.query(
      `SELECT 1
       FROM ${tableName} t
       JOIN users u ON u.id = t.created_by
       JOIN student_details sd ON sd.user_id = u.id
       WHERE t.id = $1
         AND t.object_type = 'P'
         AND t.is_deleted = FALSE
         AND u.user_type = 'student'
         AND sd.faculty_advisor_id = $2`,
      [id, approverId]
    );
    if (allowed.rows.length === 0) {
      throw new Error('You are not the assigned faculty advisor for this submission');
    }

    await pool.query(
      `UPDATE ${tableName} SET is_draft = FALSE, object_type = 'A' WHERE id = $1`, [id]
    );

    await createDecisionNotification(id, approverId, 'approved');
  }

  async function reject(id, approverId, approverType) {
    if (!isFacultyUserType(approverType)) {
      throw new Error('Only faculty advisors can reject student submissions');
    }

    const allowed = await pool.query(
      `SELECT 1
       FROM ${tableName} t
       JOIN users u ON u.id = t.created_by
       JOIN student_details sd ON sd.user_id = u.id
       WHERE t.id = $1
         AND t.object_type = 'P'
         AND t.is_deleted = FALSE
         AND u.user_type = 'student'
         AND sd.faculty_advisor_id = $2`,
      [id, approverId]
    );
    if (allowed.rows.length === 0) {
      throw new Error('You are not the assigned faculty advisor for this submission');
    }

    await pool.query(
      `UPDATE ${tableName} SET is_draft = FALSE, object_type = 'R' WHERE id = $1`, [id]
    );

    await createDecisionNotification(id, approverId, 'rejected');
  }

  return { listApproved, listUserItems, getById, createItem, updateItem, softDelete, restore, submitForApproval, approve, reject };
}

module.exports = { createCrudRoutes };
