const Router = require('express');
const route = Router();
const axios = require('axios');
const dotenv = require("dotenv");
const moment = require('moment-timezone');
dotenv.config();
const fastcsv = require('fast-csv');


const fileSystem = require("fs");
const csv = require('csv-parser');
const pool = require('../../config/db');



route.get("/config", async (req, res, next) => {
    try {
        //if email is equal to bhramar@solarad.ai, then put the sites and client name together
        const email = req.query.email;
        const resJson = await pool.query('SELECT company FROM user_details WHERE user_email = $1', [email]);
        let company = await resJson.rows[0].company;

        let sitesQuery = await pool.query('SELECT * FROM utility_sites WHERE company = $1', [company])
        if (company === process.env.ADMIN_COMPANY) {
            sitesQuery = await pool.query('SELECT * FROM utility_sites');
        }

        const sitesArr = sitesQuery.rows;
        
        if (sitesArr.length === 0) {
            sitesArr.push({
                'company': 'Demo',
                'site': 'Demo-Site',
                'ground_data_available': 'True',
                'show_ghi': 'True',
                'show_poa': 'False',
                'show_forecast': 'True',
                'lat': '28.7041',
                'lon': '77.1025'
            })
        }

        res.send(sitesArr);

    } catch (error) {
        console.error('Error fetching data from the API:', error);
        next(error);
    }
})



route.get('/data', async (req, res, next) => {
    try {
        var client = req.query.client;
        var site = req.query.site;
        if (client === 'Demo') client = process.env.DEMO_COMPANY;
        if (site === 'Demo-Site') site = process.env.DEMO_SITE;
        var timeframe = req.query.timeframe;
        let filepath = `/home/csv/${client}/${timeframe.toLowerCase()}/Solarad_${site}_${client}_${timeframe}.csv`;

        //set the headers for the response as the original filename
        res.setHeader('Content-disposition', `attachment; filename=${filepath.split(`${timeframe.toLowerCase()}/`)[1]}`);
        res.setHeader('Content-type', 'text/csv');


        // Check if the file exists
        if (!fileSystem.existsSync(filepath)) {
            res.send("File not found");
            return; // Exit the function early
        }

        const results = [];
        fileSystem.createReadStream(filepath)
            .pipe(csv())
            .on('headers', (headers) => {
                // Check if the specified column exists in the CSV file
                if (headers.includes(`Time`)) {
                    if (timeframe === "Daily") headers[headers.indexOf('Time')] = `Date`;
                    else if (timeframe === "Monthly") headers[headers.indexOf('Time')] = `Month`;
                }
            })
            .on('data', (data) => {
                results.push(data);
            })
            .on('end', () => {
                const modifiedCsv = convertToCsv(results);
                // Create a new CSV file with modified data

                // Send back the modified CSV file
                res.send(modifiedCsv);
            });
    } catch (err) {
        console.log(err);
        next(err);
    }
})


route.get('/getforecast', async (req, res, next) => {
    try {
        var client = req.query.client;
        var site = req.query.site;
        const startDate = moment(req.query.startDate, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ (z)');
        const endDate = moment(req.query.endDate, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ (z)');
        const outputFormat = 'YYYY-MM-DD';

        if (client === 'Demo') client = process.env.DEMO_COMPANY;
        if (site === 'Demo-Site') site = process.env.DEMO_SITE;

        let mergedData = [];
        let headersToConcat = ['Time', 'GHI_ID(W/m2)', 'Ground GHI', 'Gen_ID(W/m2)', 'AC_POWER_SUM'];

        for (let date = startDate; date.isSameOrBefore(endDate); date.add(1, 'days')) {
            let formattedDate = date.format(outputFormat);
            let filepath = `/home/Forecast/${client}/forecasts/Solarad_${site}_${client}_Forecast_${formattedDate}_ID.csv`;

            if (fileSystem.existsSync(filepath)) {
                const fileData = await new Promise((resolve, reject) => {
                    const rows = [];
                    fileSystem.createReadStream(filepath)
                        .pipe(csv())
                        .on('data', (row) => {
                            // Only include the specified columns
                            const filteredRow = {};
                            headersToConcat.forEach(header => {
                                filteredRow[header] = row[header];
                            });
                            rows.push(filteredRow);
                        })
                        .on('end', () => resolve(rows))
                        .on('error', reject);
                });

                mergedData = mergedData.concat(fileData);
            }
        }

        if (mergedData.length === 0) {
            res.send("Files not found");
            return;
        }

        res.setHeader('Content-disposition', `attachment; filename=Solarad_${site}_${client}_Forecast_Merged.csv`);
        res.setHeader('Content-type', 'text/csv');

        res.write(headersToConcat.join(',') + '\n'); // Write the specified headers
        mergedData.forEach(row => {
            res.write(headersToConcat.map(header => row[header]).join(',') + '\n'); // Write the specified columns
        });
        res.end();

    } catch (err) {
        console.log(err);
        next(err);
    }
});


//get utility data api
route.get('/get-utility-sites', async (req, res) => {
    try {
        const client = await pool.connect()

        // Query your PostgreSQL table
        const queryResult = await client.query('SELECT * FROM utility_sites')

        // Create a writable stream for CSV data
        const csvStream = fastcsv.format({ headers: true })

        // Write the headers to the CSV stream
        const headers = [
            'sitename', 'company', 'lat', 'lon', 'ele',
            'capacity', 'country', 'timezone', 'mount_config',
            'tilt_angle', 'ground_data_available',
            'show_ghi', 'show_poa', 'show_forecast'
        ];
        csvStream.write(headers);

        // Write the query result (rows) to the CSV stream
        queryResult.rows.forEach(row => csvStream.write(row));
        csvStream.end();

        // Close the database connection
        client.release();

        // Set the response headers for CSV download
        res.setHeader('Content-Disposition', 'attachment; filename="utility_sites.csv"');
        res.setHeader('Content-Type', 'text/csv');

        // Pipe the CSV stream to the response
        csvStream.pipe(res);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
})


// Helper function to convert data to CSV format
function convertToCsv(data) {
    const header = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map((row) => Object.values(row).join(',') + '\n');
    return header + rows.join('');
}


module.exports = route;