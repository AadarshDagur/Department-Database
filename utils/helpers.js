const pool = require('../config/database');

function normalizeUserType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'super_admin') return 'admin';
  if (normalized === 'staff') return 'admin';
  if (['ug_student', 'pg_student', 'phd_student'].includes(normalized)) return 'student';
  if (['admin', 'faculty', 'student'].includes(normalized)) return normalized;
  return 'student';
}

// Format user type for display
function formatUserType(type) {
  const normalized = normalizeUserType(type);
  const map = {
    'admin': 'Admin',
    'faculty': 'Faculty',
    'student': 'Student',
  };
  return map[normalized] || normalized;
}

// Check if user type is any kind of student
function isStudent(userType) {
  return normalizeUserType(userType) === 'student';
}

// Pagination helper
function paginate(page = 1, limit = 20) {
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (page - 1) * limit;
  return { limit, offset, page };
}

// Build pagination info for templates
function paginationInfo(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages
  };
}

// Generate users_text and tags_text from members
async function generateTexts(memberIds) {
  if (!memberIds || memberIds.length === 0) return { users_text: '', tags_text: '' };
  const result = await pool.query(
    'SELECT first_name, last_name, user_type FROM users WHERE id = ANY($1)',
    [memberIds]
  );
  const users_text = result.rows.map(u => `${u.first_name} ${u.last_name}`).join(', ');
  const typeCounts = {};
  result.rows.forEach(u => {
    const label = formatUserType(u.user_type);
    typeCounts[label] = (typeCounts[label] || 0) + 1;
  });
  const tags_text = Object.entries(typeCounts).map(([k, v]) => `${k}: ${v}`).join(', ');
  return { users_text, tags_text };
}

// Sanitize text to prevent XSS when rendering in EJS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { normalizeUserType, formatUserType, isStudent, paginate, paginationInfo, generateTexts, escapeHtml };
