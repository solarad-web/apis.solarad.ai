const Router = require("express");
const route = Router();

const dotenv = require("dotenv");
dotenv.config();

const fileSystem = require("fs");
const csv = require('csv-parser');
const bcrypt = require("bcrypt");
const pool = require("../config/db");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fastcsv = require('fast-csv');

const app = express();
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

route.get("/", async (req, res, next) => {
    let providedApiKey = req.header("api_key");
    const storedApiKey = process.env.API_KEY;


    try {
        bcrypt.compare(providedApiKey, storedApiKey, (err, result) => {
            if (result) {
                let site_id = req.query.site_id;
                var filePath = `/home/Fenice/site_${site_id}.csv`;

                // Check if the file exists
                if (!fileSystem.existsSync(filePath)) {
                    res.status(404).send("File not found");
                    return; // Exit the function early
                }

                var stat = fileSystem.statSync(filePath);

                res.set(
                    "Content-Disposition",
                    `attachment; filename=site_${site_id}.csv`
                );
                res.set("Content-Type", "text/csv");
                res.set("Content-Length", stat.size);

                // Read and process the CSV file
                const results = [];
                const unchangedResults = [];
                let columnExists = false;
                fileSystem.createReadStream(filePath)
                    .pipe(csv())
                    .on('headers', (headers) => {
                        // Check if the specified column exists in the CSV file
                        if (headers.includes(`ENTRY_TIME`)) {
                            columnExists = true;
                        }
                    })
                    .on('data', (data) => {
                        // Remove the specified column from each row
                        unchangedResults.push(data);
                        delete data[`ENTRY_TIME`];
                        results.push(data);
                    })
                    .on('end', () => {
                        const modifiedCsv = columnExists ? convertToCsv(results) : convertToCsv(unchangedResults);
                        res.send(modifiedCsv)
                    });
            } else {
                res.status(401).send("Unauthorized");
            }
        });
    }
    catch (err) {
        console.log(err.message);
        next(err);
    }
});

// Define a route to generate and send CSV data
route.get('/export-csv', async (req, res) => {
    try {
        const client = await pool.connect()

        // Query your PostgreSQL table
        const queryResult = await client.query('SELECT * FROM residential_sites WHERE company = $1', ['Fenice'])

        // Create a writable stream for CSV data
        const csvStream = fastcsv.format({ headers: true });

        // Write the headers to the CSV stream
        const headers = [
            'sitename', 'company', 'lat', 'lon', 'ele',
            'capacity', 'country', 'timezone', 'mount_config',
            'tilt_angle', 'ground_data_available'
        ];
        csvStream.write(headers);

        // Write the query result (rows) to the CSV stream
        queryResult.rows.forEach(row => csvStream.write(row));
        csvStream.end();

        // Close the database connection
        client.release();

        // Set the response headers for CSV download
        res.setHeader('Content-Disposition', 'attachment; filename="residential_sites.csv"');
        res.setHeader('Content-Type', 'text/csv');

        // Pipe the CSV stream to the response
        csvStream.pipe(res);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
})


route.post('/add-site', async (req, res, next) => {
    // Make an HTTP request to the external API
    try {
        const sitename = req.body.sitename;
        const company = req.body.company;
        const lat = req.body.lat;
        const lon = req.body.lon;
        const ele = req.body.ele;
        const capacity = req.body.capacity;
        const country = req.body.country;
        const timezone = req.body.timezone;
        const mount_config = req.body.mount_config;
        const tilt_angle = req.body.tilt_angle;
        const ground_data_available = req.body.ground_data_available;

        const { rows } = await pool.query(`
        SELECT * FROM residential_sites
        WHERE sitename = $1
          AND company = $2
          AND lat = $3
          AND lon = $4
          AND ele = $5
          AND capacity = $6
          AND country = $7
          AND timezone = $8
          AND mount_config = $9
          AND tilt_angle = $10
          AND ground_data_available = $11
      `, [sitename, company, lat, lon, ele, capacity, country, timezone, mount_config, tilt_angle, ground_data_available]);
      
      if (rows.length > 0) {
        // Site with these details already exists
        res.status(400).send('Site with these details already exists');
        return;
      }

        await pool.query(`INSERT INTO residential_sites (sitename,  company, lat, lon, ele, capacity, country, timezone, mount_config, tilt_angle, ground_data_available)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [sitename, company, lat, lon, ele, capacity, country, timezone, mount_config, tilt_angle, ground_data_available])


        res.send("Sites added successfully");
    }
    catch (err) {
        console.log(err.message);
        next(err);
    }
})





// Helper function to convert data to CSV format
function convertToCsv(data) {
    if (!data || data.length === 0) {
        return '';
    }
    const header = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map((row) => Object.values(row).join(',') + '\n');
    return header + rows.join('');
}


module.exports = route;