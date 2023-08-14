const Router = require('express');
const route = Router();
const axios = require('axios');
const dotenv = require("dotenv");
const moment = require('moment-timezone');
dotenv.config();

const fileSystem = require("fs");
const csv = require('csv-parser');
const pool = require('../../config/db');



route.get("/config", async (req, res, next) => {
    try {
        //if email is equal to bhramar@solarad.ai, then put the sites and client name together
        const email = req.query.email;
        const resJson = await pool.query('SELECT company FROM user_details WHERE user_email = $1', [email]);
        let company = await resJson.rows[0].company;

        // Make an HTTP request to the external API
        let filepath = `/home/utility-sites`;

        const sites = [];

        // Check if the file exists
        if (!fileSystem.existsSync(filepath)) {
            res.send("File not found");
            return; // Exit the function early
        }

        // Process the CSV data
        fileSystem.createReadStream(filepath)
            .pipe(csv())
            .on('data', (row) => {
                // Check if the row has the company name
                if (company === process.env.ADMIN_COMPANY) {
                    sites.push({
                        'company': row.company,
                        'site': row.sitename,
                        'ground_data_available': row.ground_data_available,
                        'show_ghi': row.show_ghi,
                        'show_poa': row.show_poa,
                        'show_forecast': row.show_forecast,
                        'lat': row.lat,
                        'lon': row.lon
                    });
                }
                else if (row.company === company) {
                    sites.push({
                        'company': row.company,
                        'site': row.sitename,
                        'ground_data_available': row.ground_data_available,
                        'show_ghi': row.show_ghi,
                        'show_poa': row.show_poa,
                        'show_forecast': row.show_forecast,
                        'lat': row.lat,
                        'lon': row.lon
                    });
                }
            })
            .on('end', () => {
                if (sites.length === 0) {
                    sites.push({
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
                res.send(sites); // Send the filtered CSV data as the response
            });

    } catch (error) {
        console.error('Error fetching data from the API:', error);
        next(error);
    }
});



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
        const inputDate = req.query.date;
        const outputFormat = 'YYYY-MM-DD';
        const formattedDate = moment(inputDate, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ (z)').format(outputFormat);

        if (client === 'Demo') client = process.env.DEMO_COMPANY;
        if (site === 'Demo-Site') site = process.env.DEMO_SITE;

        //get the current date
        let date = new Date();
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        if (month < 10) month = `0${month}`;
        let day = date.getDate();
        if (day < 10) day = `0${day}`;
        let filepath = `/home/Forecast/${client}/forecasts/Solarad_${site}_${client}_Forecast_${formattedDate}_ID.csv`;

        // Check if the file exists
        if (!fileSystem.existsSync(filepath)) {
            res.send("File not found");
            return; // Exit the function early
        }

        //set the headers for the response as the original filename
        res.setHeader('Content-disposition', `attachment; filename=Solarad_${site}_${client}_Forecast_${formattedDate}_ID.csv`);
        res.setHeader('Content-type', 'text/csv');

        //send the csv file as response from filepath
        const readStream = fileSystem.createReadStream(filepath);
        readStream.pipe(res);

    } catch (err) {
        console.log(err);
        next(err);
    }
})


route.get('/addAllSitesToDb', async (req, res, next) => {
    try {
        // Make an HTTP request to the external API
        let filepath = `/home/utility-sites`;

        // Check if the file exists
        if (!fileSystem.existsSync(filepath)) {
            res.send("File not found");
            return; // Exit the function early
        }

        // Convert the API response data into a readable stream
        const readableStream = fileSystem.createReadStream(filepath)

        readableStream
            .pipe(csv())
            .on('data', async (row) => {

                await pool.query(`INSERT INTO utility_sites (sitename, company, lat, lon, ele, capacity, country, timezone, mount_config, tilt_angle, ground_data_available, show_ghi, show_poa, show_forecast)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`, [row.sitename, row.company, row.lat, row.lon, row.ele, row.capacity, row.country, row.timezone, row.mount_config, row.tilt_angle, row.ground_data_available, row.show_ghi, row.show_poa, row.show_forecast]);
            })

        res.send("Sites added successfully")
    }
    catch (err) {
        console.log(err.message);
        next(err);
    }
});


// Helper function to convert data to CSV format
function convertToCsv(data) {
    const header = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map((row) => Object.values(row).join(',') + '\n');
    return header + rows.join('');
}


module.exports = route;