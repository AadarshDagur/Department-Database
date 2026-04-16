const { parse } = require('csv-parse/sync');
const pool = require('../config/database');

async function processCSV(buffer, fields, crud, userId, userType = null) {
  const content = buffer.toString('utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  });

  if (records.length === 0) {
    return { success: 0, errors: [{ row: 0, message: 'CSV file is empty or has no data rows' }] };
  }

  // Check if second row is a datatype descriptor row (from Django format)
  const firstRecord = records[0];
  const dtTypes = ['string', 'date', 'email_list', 'list', 'integer', 'float', 'boolean'];
  const firstValues = Object.values(firstRecord);
  const isTypeRow = firstValues.every(v => dtTypes.includes(v.toLowerCase()));
  const dataRecords = isTypeRow ? records.slice(1) : records;

  let success = 0;
  const errors = [];

  // Build lookup maps for member emails/names and department codes
  const usersResult = await pool.query(
    'SELECT id, email, first_name, last_name FROM users WHERE is_active = TRUE'
  );
  const emailMap = {};
  const nameMap = {};
  for (const u of usersResult.rows) {
    if (u.email) {
      emailMap[u.email.toLowerCase()] = u.id;
    }

    const fullName = [u.first_name, u.last_name]
      .filter(Boolean)
      .join(' ')
      .trim()
      .toLowerCase();

    if (fullName) {
      if (!nameMap[fullName]) {
        nameMap[fullName] = [];
      }
      nameMap[fullName].push(u.id);
    }
  }

  

  for (let i = 0; i < dataRecords.length; i++) {
    const row = dataRecords[i];
    const rowNum = isTypeRow ? i + 3 : i + 2; // 1-indexed, +1 for header, +1 for type row if present
    try {
      if (!row.title || !row.title.trim()) {
        errors.push({ row: rowNum, message: 'Title is required' });
        continue;
      }

      // Build data object from CSV columns matching the entity fields
      const data = {};
      for (const field of fields) {
        if (row[field] !== undefined && row[field] !== '') {
          data[field] = row[field].trim();
        }
      }

      // Handle authors/members via email or full name
      const memberValues = row.authors || row.members || row.organizers || row.participants || '';
      if (memberValues.trim()) {
        const authorTokens = memberValues
          .split(/[;,]/)
          .map(value => value.trim().toLowerCase())
          .filter(Boolean);
        const memberIds = [];
        const unmatchedAuthors = [];

        for (const token of authorTokens) {
          if (emailMap[token]) {
            memberIds.push(emailMap[token]);
            continue;
          }

          const nameMatches = nameMap[token] || [];
          if (nameMatches.length === 1) {
            memberIds.push(nameMatches[0]);
            continue;
          }

          if (nameMatches.length > 1) {
            throw new Error(`Author "${token}" matches multiple users. Use email in CSV for clarity.`);
          }

          unmatchedAuthors.push(token);
        }

        if (unmatchedAuthors.length > 0) {
          throw new Error(`Author not found: ${unmatchedAuthors.join(', ')}`);
        }

        if (memberIds.length > 0) {
          data.members = [...new Set(memberIds)];
        }
      }

      

      await crud.createItem(data, userId, false, userType);
      success++;
    } catch (err) {
      errors.push({ row: rowNum, message: err.message || 'Unknown error' });
    }
  }

  return { success, errors, total: dataRecords.length };
}

module.exports = { processCSV };
