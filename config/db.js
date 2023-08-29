const Pool = require('pg').Pool;

const pool = new Pool({
    user: "user",
    password: "pass",
    host: 'postgres',
    port: 5432,
    database: "db"
});

module.exports = pool;