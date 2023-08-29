const Pool = require('pg').Pool;
const dotenv = require('dotenv');
dotenv.config();


const pool = new Pool({
    user: process.env.DBUSER,
    password: process.env.DBPASSWORD,
    host: process.env.DBHOST,
    port: process.env.DBPORT,
    database: process.env.DBNAME,
    ssl: {
        rejectUnauthorized: false,
    }
});

module.exports = pool;