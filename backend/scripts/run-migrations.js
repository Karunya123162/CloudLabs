require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../src/db/migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${migrationFiles.length} migration files`);

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`Running migration: ${file}`);
    try {
      await pool.query(sql);
      console.log(`✓ Migration completed: ${file}`);
    } catch (err) {
      console.error(`✗ Migration failed: ${file}`);
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log('All migrations completed successfully!');
  await pool.end();
  process.exit(0);
}

runMigrations();
