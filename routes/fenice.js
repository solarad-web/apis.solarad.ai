const Router = require("express");
const route = Router();
const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const fileSystem = require("fs");
const csv = require('csv-parser');
const bcrypt = require("bcrypt");
const pool = require("../config/db");

const fastcsv = require('fast-csv');

route.use(express.json())

route.get("/", async (req, res, next) => {
    let providedApiKey = req.header("api_key");
    const storedApiKey = process.env.API_KEY;


    try {
        bcrypt.compare(providedApiKey, storedApiKey, (err, result) => {
            if (result) {
                let site_id = req.query.site_id;
                var filePath = `/home/Fenice/site_${site_id}.csv`;

                if (!fileSystem.existsSync(filePath)) {
                    res.status(404).send("File not found");
                    return;
                }

                var stat = fileSystem.statSync(filePath);

                res.set(
                    "Content-Disposition",
                    `attachment; filename=site_${site_id}.csv`
                );
                res.set("Content-Type", "text/csv");
                res.set("Content-Length", stat.size);

                const results = [];
                const unchangedResults = [];
                let columnExists = false;
                fileSystem.createReadStream(filePath)
                    .pipe(csv())
                    .on('headers', (headers) => {
                        if (headers.includes(`ENTRY_TIME`)) {
                            columnExists = true;
                        }
                    })
                    .on('data', (data) => {
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
})



route.get('/export-csv', async (req, res) => {
    try {
        const client = await pool.connect()

        const queryResult = await client.query('SELECT * FROM residential_sites WHERE company = $1', ['Fenice'])

        const csvStream = fastcsv.format({ headers: true });

        const headers = [
            'sitename', 'company', 'lat', 'lon', 'ele',
            'capacity', 'country', 'timezone', 'mount_config',
            'tilt_angle', 'ground_data_available'
        ];
        csvStream.write(headers);

        queryResult.rows.forEach(row => csvStream.write(row));
        csvStream.end();

        client.release();

        res.setHeader('Content-Disposition', 'attachment; filename="residential_sites.csv"');
        res.setHeader('Content-Type', 'text/csv');

        csvStream.pipe(res);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
})


route.post('/add-site', async (req, res, next) => {
    let providedApiKey = req.header("api_key");
    const storedApiKey = process.env.API_KEY;


    try {
        bcrypt.compare(providedApiKey, storedApiKey, async (err, result) => {
            if (result) {
                const sitename = req.body.sitename;
                const company = req.body.company || "Fenice";
                const lat = req.body.lat || 27;
                const lon = req.body.lon || 78;
                const ele = req.body.ele || 0;
                const capacity = req.body.capacity || 0;
                const country = req.body.country || "India";
                const timezone = req.body.timezone || "Asia/Kolkata";
                const mount_config = req.body.mount_config || "None";
                const tilt_angle = req.body.tilt_angle || 0;
                const ground_data_available = req.body.ground_data_available || "False";

                const latLonrows = await pool.query(`SELECT * FROM residential_sites WHERE lat = $1 AND lon = $2`, [lat, lon]);


                if (latLonrows.rows.length > 0) {
                    await pool.query(`UPDATE residential_sites SET sitename = $1, company = $2, lat = $3, lon = $4, ele = $5, capacity = $6, country = $7, timezone = $8, mount_config = $9, tilt_angle = $10, ground_data_available = $11 WHERE lat = $3 AND lon = $4`,
                        [sitename, company, lat, lon, ele, capacity, country, timezone, mount_config, tilt_angle, ground_data_available]);

                    res.send("Site updated successfully");
                }
                else {
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
                        res.status(400).send('Site with these details already exists');
                        return;
                    }

                    await pool.query(`INSERT INTO residential_sites (sitename,  company, lat, lon, ele, capacity, country, timezone, mount_config, tilt_angle, ground_data_available)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [sitename, company, lat, lon, ele, capacity, country, timezone, mount_config, tilt_angle, ground_data_available])


                    res.send("Sites added successfully");
                }

            } else {
                res.status(401).send("Unauthorized");
            }
        });
    }
    catch (err) {
        console.log(err.message);
        next(err);
    }
})



function convertToCsv(data) {
    if (!data || data.length === 0) {
        return '';
    }
    const header = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map((row) => Object.values(row).join(',') + '\n');
    return header + rows.join('');
}


module.exports = route;