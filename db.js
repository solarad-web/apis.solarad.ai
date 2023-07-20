const Pool = require('pg').Pool;

const pool = new Pool({
    user: "postgres",
    password: "Kissthesky@619",
    host: "localhost",
    port: 5432,
    database: "emaillist"
});

module.exports = pool;