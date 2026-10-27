const fs = require('node:fs');
const { TEST_DB_PATH } = require('./test-db');

module.exports = async () => {
  for (const file of [TEST_DB_PATH, `${TEST_DB_PATH}-journal`]) fs.rmSync(file, { force: true });
};
