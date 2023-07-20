const Pool = require('pg').Pool;

const pool = new Pool({
    user: "postgres",
    password: "abcd123",
    host: "localhost",
    port: 5432,
    database: "emaillist"
});

module.exports = pool;