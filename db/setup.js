const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../config/database');

async function setup() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database schema created successfully!');

    // Create default super admin
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('12345678', 10);
    await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, username, user_type)
      VALUES ($1, $2, 'Admin', 'One', 'admin1', 'admin')
      ON CONFLICT (email) DO NOTHING
    `, ['admin1@gmail.com', hash]);
    console.log('Default admin created: admin1@gmail.com / 12345678');

    process.exit(0);
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  }
}

setup();
