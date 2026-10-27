// Runs in every Jest worker before test files are loaded.
const { TEST_DB_URL } = require('./test-db');

process.env.DATABASE_URL = TEST_DB_URL;
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
