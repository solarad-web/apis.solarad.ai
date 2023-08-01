const Router = require('express');
const route = Router();

const dotenv = require("dotenv");
dotenv.config();

const fileSystem = require("fs");
const csv = require('csv-parser');
const pool = require('../../config/db');
const axios = require('axios');
const { Readable } = require('stream');


route.get("/config", async (req, res, next) => {
    try {
        const email = req.query.email;
        const resJson = await pool.query('SELECT company FROM user_details WHERE user_email = $1', [email]);
        const company = await resJson.rows[0].company;

        // Make an HTTP request to the external API
        const apiResponse = await axios.get('https://gm33of7aig.execute-api.ap-south-1.amazonaws.com/dev/get-utility-sites');

        const sites = [];

        // Convert the API response data into a readable stream
        const readableStream = new Readable();
        readableStream.push(apiResponse.data);
        readableStream.push(null); // Signals the end of data

        // Process the CSV data
        readableStream
            .pipe(csv())
            .on('data', (row) => {
                // Check if the row has the company name
                if (row.company === company) {
                    sites.push({
                        'company': row.company,
                        'site': row.sitename,
                        'ground_data_available': row.ground_data_available,
                        'show_ghi': row.show_ghi,
                        'show_poa': row.show_poa,
                        'show_forecast': row.show_forecast
                    });
                }
            })
            .on('end', () => {
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
        var timeframe = req.query.timeframe;
        var filepath = `/home/csv/${client}/${timeframe.toLowerCase()}/Solarad_${site}_${client}_${timeframe}_UTC.csv`;

        // Check if the file exists
        if (!fileSystem.existsSync(filepath)) {
            res.status(404).send("File not found");
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

        //get the current date
        let date = new Date();
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        if (month < 10) month = `0${month}`;
        let day = date.getDate();
        if (day < 10) day = `0${day}`;
        let filepath = `/home/Forecast/${client}/forecasts/Solarad_${site}_${client}_Forecast_${year}-${month}-${day}_ID.csv`;

        // Check if the file exists
        if (!fileSystem.existsSync(filepath)) {
            res.status(404).send("File not found");
            return; // Exit the function early
        }

        //send the csv file as response from filepath
        const readStream = fileSystem.createReadStream(filepath);
        readStream.pipe(res);

    } catch (err) {
        console.log(err);
        next(err);
    }
})


//get the current date and make sure to add a 0 before the month and day if they are single digit

function getCurrentDate() {
    let date = new Date();
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    if (month < 10) month = `0${month}`;
    let day = date.getDate();
    if (day < 10) day = `0${day}`;
    return `${year}-${month}-${day}`;
}


// Helper function to convert data to CSV format
function convertToCsv(data) {
    const header = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map((row) => Object.values(row).join(',') + '\n');
    return header + rows.join('');
}


module.exports = route;