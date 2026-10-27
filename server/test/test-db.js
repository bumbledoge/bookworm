const path = require('node:path');

// Integration tests run against a throwaway SQLite database so they can never touch dev.db.
const TEST_DB_PATH = path.resolve(__dirname, 'test.db');

module.exports = {
  TEST_DB_PATH,
  TEST_DB_URL: `file:${TEST_DB_PATH}`,
};
