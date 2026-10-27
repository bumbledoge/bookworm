const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { TEST_DB_PATH, TEST_DB_URL } = require('./test-db');

// Runs once before the whole suite: fresh schema + seed data in the test database.
module.exports = async () => {
  for (const file of [TEST_DB_PATH, `${TEST_DB_PATH}-journal`]) fs.rmSync(file, { force: true });

  const opts = {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'pipe',
  };
  execSync('npx prisma db push --skip-generate --accept-data-loss', opts);
  execSync('npx tsx prisma/seed.ts', opts);
};
