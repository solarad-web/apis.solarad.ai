const Router = require('express');
const route = Router();
const axios = require('axios');
const dotenv = require("dotenv");
const moment = require('moment-timezone');
dotenv.config();

const fileSystem = require("fs");
const csv = require('csv-parser');
const pool = require('../../config/db');
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
                if (sites.length === 0) {
                    sites.push({
                        'company': 'Demo',
                        'site': 'Bhilai',
                        'ground_data_available': 'True',
                        'show_ghi': 'True',
                        'show_poa': 'False',
                        'show_forecast': 'True'
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
        if (client === 'Demo') client = 'Refex';
        if (site === 'Demo-Site') site = 'Bhilai';
        var timeframe = req.query.timeframe;
        let filepath = `/home/csv/${client}/${timeframe.toLowerCase()}/Solarad_${site}_${client}_${timeframe}.csv`;

        //set the headers for the response as the original filename
        res.setHeader('Content-disposition', `attachment; filename=${filepath.split(`${timeframe.toLowerCase()}/`)[1]}`);
        res.setHeader('Content-type', 'text/csv');


        // Check if the file exists
        if (!fileSystem.existsSync(filepath)) {
            console.log('File not found')
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

        if(client === 'Demo') client = 'Refex';
        if(site === 'Demo-Site') site = 'Bhilai';

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
            console.log('File not found')
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


// Helper function to convert data to CSV format
function convertToCsv(data) {
    const header = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map((row) => Object.values(row).join(',') + '\n');
    return header + rows.join('');
}


module.exports = route;