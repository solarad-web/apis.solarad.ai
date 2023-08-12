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
      const client = await pool.connect();
  
      // Query your PostgreSQL table
      const queryResult = await client.query('SELECT * FROM residential_sites');
  
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
  });


route.get('/add-site', async (req, res, next) => {

    // Make an HTTP request to the external API
    try {
        let filepath = `/home/residential-sites`;

        // Convert the API response data into a readable stream
        const readableStream = fileSystem.createReadStream(filepath);

        readableStream
            .pipe(csv())
            .on('data', async (row) => {
                await pool.query(`INSERT INTO residential_sites (sitename, company, lat, lon, ele, capacity, country, timezone, mount_config, tilt_angle, ground_data_available)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [row.sitename, row.company, row.lat, row.lon, row.ele, row.capacity, row.country, row.timezone, row.mount_config, row.tilt_angle, row.ground_data_available]);
            })

        res.send("Sites added successfully");
    }
    catch (err) {
        console.log(err.message);
        next(err);
    }
});





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