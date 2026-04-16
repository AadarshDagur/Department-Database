const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const poolConfig = isProduction || process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DB_POOL_MAX || 20),
      ssl: isProduction ? { rejectUnauthorized: false } : false
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'department_database',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: parseInt(process.env.DB_POOL_MAX || 20),
      ssl: false
    };

const pool = new Pool(poolConfig);

module.exports = pool;
