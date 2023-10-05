const Router = require('express')
const route = Router()
const dotenv = require("dotenv")
const moment = require('moment-timezone')
dotenv.config()
const fastcsv = require('fast-csv')

const axios = require('axios')
const csvParser = require('csv-parser')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const fileSystem = require("fs")
const csv = require('csv-parser')
const pool = require('../../config/db')

//done
//done
route.get("/config", async (req, res, next) => {
    try {
        const email = req.query.email;
        const resJson = await pool.query('SELECT company FROM user_details WHERE user_email = $1', [email])
        let company = await resJson.rows[0].company

        let sitesQuery = await pool.query('SELECT * FROM utility_sites WHERE company = $1 AND show_dashboard = $2', [company, true])

        const sitesArr = sitesQuery.rows

        if (sitesArr.length === 0) {
            sitesArr.push({
                'company': 'Demo',
                'site': 'Demo-Site',
                'ground_data_available': 'True',
                'show_ghi': 'True',
                'show_poa': 'True',
                'show_forecast': 'True',
                'lat': '28.7041',
                'lon': '77.1025',
                'forecast_graphs': [
                    {
                        "graphName": "Generation Forecast",
                        "setPastDays": 0,
                        "setFutureDays": 0,
                        "dropdown": true,
                        "chartParameters": ["Solarad", "Ground"],
                        "errors": ["MAPE"]
                    },
                    {
                        "graphName": "Forecast GHI",
                        "setPastDays": 0,
                        "setFutureDays": 0,
                        "dropdown": true,
                        "chartParameters": ["Solarad", "Ground"],
                        "errors": ["MAE"]
                    },
                    {
                        "graphName": "Forecast POA",
                        "setPastDays": 0,
                        "setFutureDays": 0,
                        "dropdown": true,
                        "chartParameters": ["Solarad", "Ground"],
                        "errors": ["MAE"]
                    }
                ],
                'historical_graphs': [
                    {
                        "graphName": "Global Horizontal Irradiance",
                        "setPastDays": 0,
                        "setFutureDays": 0,
                        "dropdown": true,
                        "chartParameters": ["Solarad", "Ground"]
                    },
                    {
                        "graphName": "Plane Of Array Irradiance",
                        "setPastDays": 0,
                        "setFutureDays": 0,
                        "dropdown": true,
                        "chartParameters": ["Solarad", "Ground"]
                    }
                ]

            })
        }

        res.send(sitesArr)

    } catch (error) {
        console.error('Error fetching data from the API:', error)
        next(error)
    }
})

//done
//done
route.get('/data', async (req, res, next) => {
    try {
        var client = req.query.client;
        var site = req.query.site;
        let isDemoClient = false;
        if (client === 'Demo') {
            client = process.env.DEMO_COMPANY;
            isDemoClient = true;
        }
        if (site === 'Demo-Site') {
            site = process.env.DEMO_SITE;
            isDemoClient = true;
        }

        var timeframe = req.query.timeframe;
        let filepath = `/home/csv/${client}/${timeframe.toLowerCase()}/Solarad_${site}_${client}_${timeframe}.csv`;

        res.setHeader('Content-disposition', `attachment; filename=${filepath.split(`${timeframe.toLowerCase()}/`)[1]}`);
        res.setHeader('Content-type', 'text/csv');


        if (!fileSystem.existsSync(filepath)) {
            res.send("File not found");
            return;
        }

        const results = [];
        if (isDemoClient) {
            fileSystem.createReadStream(filepath)
                .pipe(csv())
                .on('headers', (headers) => {
                    if (headers.includes(`Time`)) {
                        if (timeframe === "Daily") headers[headers.indexOf('Time')] = `Date`;
                        else if (timeframe === "Monthly") headers[headers.indexOf('Time')] = `Month`;
                    }
                })
                .on('data', (data) => {
                    data['Ground POA'] = (data['POA'] * (Math.random() * (1.05 - 0.95) + 0.95)).toFixed(2);
                    data['Ground GHI'] = (data['GHI'] * (Math.random() * (1.05 - 0.95) + 0.95)).toFixed(2);

                    results.push(data);
                })
                .on('end', () => {
                    const modifiedCsv = convertToCsv(results);

                    res.send(modifiedCsv);
                });
        }
        else {
            fileSystem.createReadStream(filepath)
                .pipe(csv())
                .on('headers', (headers) => {
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

                    res.send(modifiedCsv);
                });
        }
    } catch (err) {
        console.log(err);
        next(err);
    }
})

//done
//done
route.get('/getforecast', async (req, res, next) => {
    try {
        var client = req.query.client;
        var site = req.query.site;
        let isDemoClient = false;
        const startDate = moment(req.query.startDate, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ (z)');
        const endDate = moment(req.query.endDate, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ (z)');
        const outputFormat = 'YYYY-MM-DD';
        const today = moment();
        const currentTime = moment().format('YYYY-MM-DD HH:mm:ssZ');

        if (client === 'Demo' && site === 'Demo-Site') {
            client = process.env.DEMO_COMPANY;
            site = process.env.DEMO_SITE;
            isDemoClient = true;
        }

        //get folder from id 1 of prod_foldername_current_date
        const query = await pool.query(`SELECT forecast_type FROM utility_sites WHERE sitename=$1 AND company=$2`, [site, client])
        let folder = isDemoClient ? 'ml_forecasts' : query.rows[0].forecast_type

        let mergedData = []
        let headersToConcat = []
        let maxHeaders = 0

        for (let date = startDate; date.isSameOrBefore(endDate); date.add(1, 'days')) {
            let formattedDate = date.format(outputFormat);
            //check if date is equal to current date
            let filepath = `/home/Forecast/${client}/ml_forecasts/Solarad_${site}_${client}_Forecast_${formattedDate}_ID.csv`;

            if (!isDemoClient && date.isSame(today, 'day')) {
                filepath = `/home/Forecast/${client}/${folder}/Solarad_${site}_${client}_Forecast_${formattedDate}_ID.csv`;
            }
            let fileHeaders = [];
            if (fileSystem.existsSync(filepath)) {
                const sampleReadStream = fileSystem.createReadStream(filepath);
                sampleReadStream
                    .pipe(csv())
                    .on('headers', (headers) => {
                        fileHeaders = headers;
                        if (maxHeaders < fileHeaders.length) {
                            headersToConcat = headers;
                            maxHeaders = fileHeaders.length;
                        }
                    });
            }

            if (fileSystem.existsSync(filepath)) {
                if (isDemoClient) {
                    const random = (Math.random() * (1.1 - 0.9) + 0.9).toFixed(2);
                    const fileData = await new Promise((resolve, reject) => {
                        const rows = [];
                        fileSystem.createReadStream(filepath)
                            .pipe(csv())
                            .on('data', (row) => {
                                const filteredRow = {};
                                fileHeaders.forEach(header => {
                                    const rowTime = moment(filteredRow['Time'], 'YYYY-MM-DD HH:mm:ssZ');
                                    if (date.isSameOrBefore(currentTime)) {
                                        if (header === 'Ground GHI') {
                                            filteredRow[header] = (row['Ground GHI'] * random).toFixed(2);
                                        }
                                        else if (header === 'Ground POA') {
                                            filteredRow[header] = (row['Ground POA'] * random).toFixed(2);
                                        }
                                        else if (header === 'AC_POWER_SUM') {
                                            filteredRow[header] = (row['AC_POWER_SUM'] * random).toFixed(2);
                                        }
                                        else if (header === 'Gen Rev0') {
                                            filteredRow[header] = (row['Gen Rev0'] * random).toFixed(2);
                                        }
                                        else if (header === 'Gen Rev1') {
                                            filteredRow[header] = (row['Gen Rev1'] * random).toFixed(2);
                                        }
                                        else if (header === 'Gen Rev2') {
                                            filteredRow[header] = (row['Gen Rev2'] * random).toFixed(2);
                                        }
                                        else if (header === 'Gen Rev3') {
                                            filteredRow[header] = (row['Gen Rev3'] * random).toFixed(2);
                                        }
                                        else if (header === 'Gen Rev4') {
                                            filteredRow[header] = (row['Gen Rev4'] * random).toFixed(2);
                                        }
                                        else if (header === 'Gen Rev5') {
                                            filteredRow[header] = (row['Gen Rev5'] * random).toFixed(2);
                                        }
                                        else if (header === 'Gen Rev6') {
                                            filteredRow[header] = (row['Gen Rev6'] * random).toFixed(2);
                                        }
                                        else if (header === 'Gen Rev7') {
                                            filteredRow[header] = (row['Gen Rev7'] * random).toFixed(2);
                                        }
                                        else if (header === 'Gen Rev8') {
                                            filteredRow[header] = (row['Gen Rev8'] * random).toFixed(2);
                                        }
                                        else if (header === 'Gen Rev9') {
                                            filteredRow[header] = (row['Gen Rev9'] * random).toFixed(2);
                                        }
                                        else if (header === 'GHI Final') {
                                            filteredRow[header] = (row['GHI Final'] * random).toFixed(2);
                                        }
                                        else if (header === 'POA Final') {
                                            filteredRow[header] = (row['POA Final'] * random).toFixed(2);
                                        }
                                        else if (header === 'Gen Final') {
                                            filteredRow[header] = (row['Gen Final'] * random).toFixed(2);
                                        }
                                        else if (header === 'GHI Rev0') {
                                            filteredRow[header] = (row['GHI Rev0'] * random).toFixed(2);
                                        }
                                        else if (header === 'GHI Rev1') {
                                            filteredRow[header] = (row['GHI Rev1'] * random).toFixed(2);
                                        }
                                        else if (header === 'GHI Rev2') {
                                            filteredRow[header] = (row['GHI Rev2'] * random).toFixed(2);
                                        }
                                        else if (header === 'GHI Rev3') {
                                            filteredRow[header] = (row['GHI Rev3'] * random).toFixed(2);
                                        }
                                        else if (header === 'GHI Rev4') {
                                            filteredRow[header] = (row['GHI Rev4'] * random).toFixed(2);
                                        }
                                        else if (header === 'GHI Rev5') {
                                            filteredRow[header] = (row['GHI Rev5'] * random).toFixed(2);
                                        }
                                        else if (header === 'GHI Rev6') {
                                            filteredRow[header] = (row['GHI Rev6'] * random).toFixed(2);
                                        }
                                        else if (header === 'GHI Rev7') {
                                            filteredRow[header] = (row['GHI Rev7'] * random).toFixed(2);
                                        }
                                        else if (header === 'GHI Rev8') {
                                            filteredRow[header] = (row['GHI Rev8'] * random).toFixed(2);
                                        }
                                        else if (header === 'GHI Rev9') {
                                            filteredRow[header] = (row['GHI Rev9'] * random).toFixed(2);
                                        }
                                        else filteredRow[header] = row[header];
                                    }
                                    else {
                                        if (header === 'Ground GHI') {
                                            filteredRow[header] = 0;
                                        }
                                        else if (header === 'Ground POA') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'AC_POWER_SUM') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'Gen Rev0') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'Gen Rev1') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'Gen Rev2') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'Gen Rev3') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'Gen Rev4') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'Gen Rev5') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'Gen Rev6') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'Gen Rev7') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'Gen Rev8') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'Gen Rev9') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'GHI Final') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'POA Final') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'Gen Final') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'GHI Rev0') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'GHI Rev1') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'GHI Rev2') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'GHI Rev3') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'GHI Rev4') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'GHI Rev5') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'GHI Rev6') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'GHI Rev7') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'GHI Rev8') {
                                            filteredRow[header] = 0
                                        }
                                        else if (header === 'GHI Rev9') {
                                            filteredRow[header] = 0
                                        }
                                        else filteredRow[header] = row[header];
                                    }
                                });
                                rows.push(filteredRow);
                            })
                            .on('end', () => resolve(rows))
                            .on('error', reject);
                    });
                    mergedData = mergedData.concat(fileData);
                }
                else {
                    const fileData = await new Promise((resolve, reject) => {
                        const rows = [];
                        fileSystem.createReadStream(filepath)
                            .pipe(csv())
                            .on('data', (row, index) => {
                                const filteredRow = {};
                                headersToConcat.forEach(header => {
                                    filteredRow[header] = row[header];
                                });
                                rows.push(filteredRow);
                            })
                            .on('end', () => resolve(rows))
                            .on('error', reject);
                    });
                    console.log(fileData[0])
                    mergedData = mergedData.concat(fileData)
                }
            }
        }

        if (mergedData.length === 0) {
            res.send("Files not found");
            return;
        }

        res.setHeader('Content-disposition', `attachment; filename=Solarad_${site}_${client}_Forecast_Merged.csv`);
        res.setHeader('Content-type', 'text/csv');

        res.write(headersToConcat.join(',') + '\n');
        mergedData.forEach(row => {
            res.write(headersToConcat.map(header => row[header]).join(',') + '\n');
        });
        res.end();

    } catch (err) {
        console.log(err);
        next(err);
    }
})


route.get('/getforecastFromDb', async (req, res, next) => {
    try {
        var client = req.query.client;
        var site = req.query.site;
        let isDemoClient = false;
        const startDate = moment(req.query.startDate, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ (z)');
        const endDate = moment(req.query.endDate, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ (z)');
        const outputFormat = 'YYYY-MM-DD';
        const today = moment();
        const currentTime = moment().format('YYYY-MM-DD HH:mm:ssZ');
        const startMoment = moment(startDate).subtract(5, 'hours').subtract(30, 'minutes');
        const endMoment = moment(endDate).subtract(5, 'hours').subtract(30, 'minutes');

        const formattedStartDate = startMoment.format('YYYY-MM-DD HH:mm:ssZ');
        const formattedEndDate = endMoment.format('YYYY-MM-DD HH:mm:ssZ');

        if (client === 'Demo' && site === 'Demo-Site') {
            client = process.env.DEMO_COMPANY;
            site = process.env.DEMO_SITE;
            isDemoClient = true;
        }

        const siteIdQuery = await pool.query(`SELECT id FROM utility_sites WHERE sitename=$1 AND company=$2`, [site, client])

        const siteId = siteIdQuery.rows[0].id

        const genDataQuery = await pool.query(`
            SELECT block,
            time AT TIME ZONE 'Asia/Kolkata', 
            revision_number, forecast_variable, value
            FROM forecast_prod 
            WHERE site_id=$1 AND time >= $2 AND time <= $3 AND forecast_variable = 'Gen'
            order by time asc, block asc, revision_number asc, forecast_variable asc
        `, [siteId, formattedStartDate, formattedEndDate])

        const ghiDataQuery = await pool.query(`
            SELECT block,
            time AT TIME ZONE 'Asia/Kolkata',
            revision_number, forecast_variable, value
            FROM forecast_prod
            WHERE site_id=$1 AND time >= $2 AND time <= $3 AND forecast_variable = 'GHI'
            order by time asc, block asc, revision_number asc, forecast_variable asc
        `, [siteId, formattedStartDate, formattedEndDate])

        const poaDataQuery = await pool.query(`
            SELECT block,
            time AT TIME ZONE 'Asia/Kolkata',
            revision_number, forecast_variable, value
            FROM forecast_prod
            WHERE site_id=$1 AND time >= $2 AND time <= $3 AND forecast_variable = 'POA'
            order by time asc, block asc, revision_number asc, forecast_variable asc
        `, [siteId, formattedStartDate, formattedEndDate])

        // dataQuery.rows.forEach((row, index) => {})

        const groundDataQuery = await pool.query(`
            SELECT time AT TIME ZONE 'Asia/Kolkata',
            ground_ghi, ground_poa, ground_generation
            FROM ground_data
            WHERE site_id=$1 AND time >= $2 AND time <= $3
            order by time asc
        `, [siteId, formattedStartDate, formattedEndDate])

        res.send(groundDataQuery.rows.length.toString() + ' ' + genDataQuery.rows.length.toString() + ' ' + ghiDataQuery.rows.length.toString() + ' ' + poaDataQuery.rows.length.toString())
        
    } catch (err) {
        console.log(err);
        next(err);
    }
})

//done
//done
route.get('/get-utility-sites', async (req, res) => {
    try {
        const queryResult = await pool.query('SELECT id, created_at, * FROM utility_sites order by id asc')

        const csvStream = fastcsv.format({ headers: true })

        const headers = [
            'id', 'created_at', 'sitename', 'state', 'company', 'lat', 'lon', 'ele',
            'capacity', 'country', 'timezone', 'mount_config',
            'tilt_angle', 'ground_data_available',
            'show_ghi', 'show_poa', 'show_forecast'
        ];
        csvStream.write(headers);

        queryResult.rows.forEach(row => csvStream.write(row));
        csvStream.end();

        res.setHeader('Content-Disposition', 'attachment; filename="utility_sites.csv"');
        res.setHeader('Content-Type', 'text/csv');

        csvStream.pipe(res);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
})

//done
//done
route.get('/get-residential-sites', async (req, res) => {
    try {
        const queryResult = await pool.query('SELECT * FROM residential_sites')

        const csvStream = fastcsv.format({ headers: true })

        const headers = [
            'sitename', 'company', 'lat', 'lon', 'ele',
            'capacity', 'country', 'timezone', 'mount_config',
            'tilt_angle', 'ground_data_available'
        ];
        csvStream.write(headers);

        queryResult.rows.forEach(row => csvStream.write(row));
        csvStream.end();

        res.setHeader('Content-Disposition', 'attachment; filename="residential_sites.csv"');
        res.setHeader('Content-Type', 'text/csv');

        csvStream.pipe(res);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
})



//done
//done
route.get('/get-all-sites', async (req, res) => {
    try {
        const queryResult = await pool.query('SELECT DISTINCT user_email FROM user_details');
        const emails = queryResult.rows.map(row => row.user_email);

        let sites = [];
        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            const company = await pool.query('SELECT company FROM user_details WHERE user_email = $1', [email]);
            let companySites = await pool.query('SELECT sitename FROM utility_sites WHERE company = $1', [company.rows[0].company]);
            if (company.rows[0].company === process.env.ADMIN_COMPANY || company.rows[0].company === process.env.SUPERADMIN_COMPANY) companySites = await pool.query('SELECT sitename FROM utility_sites');

            if (companySites.rows.length === 0) {
                companySites.rows.push({
                    sitename: 'Demo-Site'
                })
            }
            sites.push({
                email: email,
                company: company.rows[0].company,
                sites: companySites.rows.map(row => row.sitename)
            })

        }
        res.send(sites);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
})

//done
//done
route.get('/convertHourlyToDailyOpenMeteo', async (req, res, next) => {
    try {
        const lat = req.query.lat;
        const lon = req.query.lon;
        const year = req.query.year;
        const timezone = req.query.timezone;
        const apiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${year}-01-01&end_date=${year}-12-31&hourly=temperature_2m,relativehumidity_2m,precipitation,surface_pressure,cloudcover,shortwave_radiation,diffuse_radiation,direct_normal_irradiance&timezone=GMT&format=csv`;
        const response = await axios.get(apiUrl);
        const csvData = response.data;

        const dailyData = {};
        let dataStarted = false;

        csvParser()
            .on('data', (row) => {
                // Skip the header rows
                if (row.latitude === 'time') {
                    dataStarted = true;
                    return;
                }
                if (!dataStarted) return;

                const dateUTC = row.latitude;
                const dateTimezone = moment.tz(dateUTC, timezone);
                const dateKey = dateTimezone.format('YYYY-MM-DD');

                if (!dailyData[dateKey]) {
                    dailyData[dateKey] = {
                        count: 1,
                        longitude: parseFloat(row.longitude),
                        elevation: parseFloat(row.elevation),
                        utc_offset_seconds: parseFloat(row.utc_offset_seconds),
                        timezone: parseFloat(row.timezone),
                        timezone_abbreviation: parseFloat(row.timezone_abbreviation),
                        _6: parseFloat(row._6),
                        _7: parseFloat(row._7),
                        _8: parseFloat(row._8),
                        convertedDate: dateTimezone.format()
                    };
                } else {
                    dailyData[dateKey].count++;
                    dailyData[dateKey].longitude += parseFloat(row.longitude);
                    dailyData[dateKey].elevation += parseFloat(row.elevation);
                    dailyData[dateKey].utc_offset_seconds += parseFloat(row.utc_offset_seconds);
                    dailyData[dateKey].timezone += parseFloat(row.timezone);
                    dailyData[dateKey].timezone_abbreviation += parseFloat(row.timezone_abbreviation);
                    dailyData[dateKey]._6 += parseFloat(row._6);
                    dailyData[dateKey]._7 += parseFloat(row._7);
                    dailyData[dateKey]._8 += parseFloat(row._8);
                }
            })
            .on('end', () => {

            })
            .write(csvData)
        const dailyArray = Object.values(dailyData).map(row => {
            return {
                'time': row.convertedDate.split('T')[0],
                'temperature_2m (°C)': (row.longitude / row.count).toFixed(2),
                'relativehumidity_2m (%)': (row.elevation / row.count).toFixed(2),
                'precipitation (mm)': (row.utc_offset_seconds / row.count).toFixed(2),
                'surface_pressure (hPa)': (row.timezone / row.count).toFixed(2),
                'cloudcover (%)': (row.timezone_abbreviation / row.count).toFixed(2), // Fixed cloud cover calculation
                'shortwave_radiation (kWh/m²)': row._6.toFixed(2),
                'diffuse_radiation (kWh/m²)': row._7.toFixed(2),
                'direct_normal_irradiance (kWh/m²)': row._8.toFixed(2)
            };
        });
        const csvWriter = createCsvWriter({
            path: 'output.csv',
            header: Object.keys(dailyArray[0]).map((key) => ({ id: key, title: key })),
        });
        csvWriter.writeRecords(dailyArray).then(() => {
            res.download('output.csv');
        });

    }
    catch (err) {
        console.log(err);
        next(err);
    }
});


function convertToCsv(data) {
    const header = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map((row) => Object.values(row).join(',') + '\n');
    return header + rows.join('');
}


module.exports = route;