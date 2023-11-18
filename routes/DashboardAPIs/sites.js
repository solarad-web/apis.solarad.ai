const Router = require('express')
const sitesRoute = Router()
const dotenv = require("dotenv")
const moment = require('moment-timezone')
dotenv.config()
const fastcsv = require('fast-csv')
const axios = require('axios')
const csvParser = require('csv-parser')
const { Parser } = require('json2csv')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const fileSystem = require("fs")
const csv = require('csv-parser')
const pool = require('../../config/db')
const axios = require('axios')

//done
//done
sitesRoute.get("/config", async (req, res, next) => {
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
                'state': 'Chhattisgarh',
                'capacity': '50',
                'ground_data_available': 'True',
                'show_ghi': 'True',
                'forecast_startdate': '2023-08-01',
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
sitesRoute.get('/data', async (req, res, next) => {
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
        let filepath = `/home/csv/clients/${client}/${timeframe.toLowerCase()}/Solarad_${site}_${client}_${timeframe}.csv`;

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
sitesRoute.get('/getforecast', async (req, res, next) => {
    try {
        const { client: queryClient, site: querySite, startDate: start, endDate: end } = req.query;

        let client = queryClient;
        let site = querySite;
        const isDemoClient = (queryClient === 'Demo' && querySite === 'Demo-Site');

        if (isDemoClient) {
            client = process.env.DEMO_COMPANY;
            site = process.env.DEMO_SITE;
        }

        const startDate = moment(start, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ (z)')
        const endDate = moment(end, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ (z)')
        const outputFormat = 'YYYY-MM-DD';
        const today = moment();

        const query = await pool.query(`SELECT forecast_type FROM utility_sites WHERE sitename=$1 AND company=$2`, [site, client]);
        const folder = isDemoClient ? 'ml_forecasts' : query.rows[0].forecast_type;

        let mergedData = [];
        let headersToConcat = [];
        let maxHeaders = 0;

        const headersToModify = [
            'Ground GHI', 'Ground POA', 'AC_POWER_SUM', 'Gen Rev0', 'Gen Rev1',
            'Gen Rev2', 'Gen Rev3', 'Gen Rev4', 'Gen Rev5', 'Gen Rev6', 'Gen Rev7',
            'Gen Rev8', 'Gen Rev9', 'GHI Final', 'POA Final', 'Gen Final', 'GHI Rev0',
            'GHI Rev1', 'GHI Rev2', 'GHI Rev3', 'GHI Rev4', 'GHI Rev5', 'GHI Rev6',
            'GHI Rev7', 'GHI Rev8', 'GHI Rev9'
        ];

        for (let date = startDate; date.isSameOrBefore(endDate); date.add(1, 'days')) {
            const formattedDate = date.format(outputFormat);
            const isCurrentDay = date.isSame(today, 'day');
            const basepath = `/home/csv/clients/${client}/${isDemoClient ? 'ml_forecasts' : (isCurrentDay ? folder : 'ml_forecasts')}`;
            const filepath = `${basepath}/Solarad_${site}_${client}_Forecast_${formattedDate}_ID.csv`;

            if (fileSystem.existsSync(filepath)) {
                const random = isDemoClient ? (Math.random() * (1.1 - 0.9) + 0.9).toFixed(2) : null;

                const fileData = await new Promise((resolve, reject) => {
                    const rows = [];
                    fileSystem.createReadStream(filepath)
                        .pipe(csv())
                        .on('headers', (headers) => {
                            if (maxHeaders < headers.length) {
                                headersToConcat = headers;
                                maxHeaders = headers.length;
                            }
                        })
                        .on('data', (row) => {
                            const filteredRow = {};

                            headersToConcat.forEach(header => {
                                if (isDemoClient && headersToModify.includes(header)) {
                                    filteredRow[header] = (row[header] * random).toFixed(2);
                                } else {
                                    filteredRow[header] = row[header];
                                }
                            });

                            rows.push(filteredRow);
                        })
                        .on('end', () => resolve(rows))
                        .on('error', reject);
                });

                mergedData = [...mergedData, ...fileData];
            }
        }

        if (!mergedData.length) {
            return res.send("Files not found");
        }

        res.setHeader('Content-disposition', `attachment; filename=Solarad_${site}_${client}_Forecast_Merged.csv`);
        res.setHeader('Content-type', 'text/csv');
        res.write(headersToConcat.join(',') + '\n');
        mergedData.forEach(row => res.write(headersToConcat.map(header => row[header]).join(',') + '\n'));
        res.end();

    } catch (err) {
        console.log(err);
        next(err);
    }
});



sitesRoute.get('/getforecastFromDb', async (req, res, next) => {
    try {
        var client = req.query.client
        var site = req.query.site
        let isDemoClient = false
        const startDate = moment(req.query.startDate, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ (z)').startOf('day');
        const endDate = moment(req.query.endDate, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ (z)').endOf('day');

        const startMoment = moment(startDate).subtract(5, 'hours').subtract(30, 'minutes')
        const endMoment = moment(endDate).subtract(5, 'hours').subtract(30, 'minutes')

        const formattedStartDate = startMoment.format('YYYY-MM-DD HH:mm:ssZ')
        const formattedEndDate = endMoment.format('YYYY-MM-DD HH:mm:ssZ')

        if (client === 'Demo' && site === 'Demo-Site') {
            client = process.env.DEMO_COMPANY;
            site = process.env.DEMO_SITE;
            isDemoClient = true;
        }

        const siteIdQuery = await pool.query(`SELECT id FROM utility_sites WHERE sitename=$1 AND company=$2`, [site, client])

        const siteId = siteIdQuery.rows[0].id

        const query = await pool.query(`
        WITH PivotData AS (
            SELECT
                block,
                (time + interval '5 hours 30 minutes') as adjusted_time,
                site_id,
                forecast_variable,
                revision_number,
                Value
            FROM forecast_prod
            WHERE site_id = $1 AND time >= $2 AND time < $3
        ),
        newGroundData AS (
            SELECT
                site_id,
                (time + interval '5 hours 30 minutes') as adjusted_time,
                MAX(value) FILTER (WHERE ground_variable = 'ground_generation') AS ground_generation,
                MAX(value) FILTER (WHERE ground_variable = 'ground_ghi') AS ground_ghi,
                MAX(value) FILTER (WHERE ground_variable = 'ground_poa') AS ground_poa
            FROM ground_prod
            WHERE site_id = $1 AND time >= $2 AND time < $3
            GROUP BY site_id, time
        )
        
        SELECT
            p.block AS "Block",
            p.adjusted_time as "Time",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev0') AS "GHI Rev0",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev1') AS "GHI Rev1",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev2') AS "GHI Rev2",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev3') AS "GHI Rev3",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev4') AS "GHI Rev4",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev5') AS "GHI Rev5",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev6') AS "GHI Rev6",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev7') AS "GHI Rev7",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev8') AS "GHI Rev8",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev9') AS "GHI Rev9",

            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev0') AS "Gen Rev0",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev1') AS "Gen Rev1",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev2') AS "Gen Rev2",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev3') AS "Gen Rev3",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev4') AS "Gen Rev4",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev5') AS "Gen Rev5",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev6') AS "Gen Rev6",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev7') AS "Gen Rev7",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev8') AS "Gen Rev8",
            MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev9') AS "Gen Rev9",
        
            COALESCE(
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev9'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev8'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev7'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev6'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev5'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev4'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev3'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev2'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev1'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'Rev0'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'GHI' AND p.revision_number = 'two_days_ahead')
            ) AS "GHI Final",
            
            COALESCE(
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev9'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev8'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev7'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev6'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev5'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev4'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev3'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev2'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev1'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'Rev0'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'Gen' AND p.revision_number = 'two_days_ahead')
            ) AS "Gen Final",
            
            COALESCE(
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'POA' AND p.revision_number = 'Rev0'),
                MAX(p.Value) FILTER (WHERE p.forecast_variable = 'POA' AND p.revision_number = 'two_days_ahead')
            ) AS "POA Final",
            
        
            g.ground_generation AS "AC_POWER_SUM",
            g.ground_ghi AS "Ground GHI",
            g.ground_poa AS "Ground POA"
        
        FROM PivotData p
        LEFT JOIN newGroundData g ON p.adjusted_time = g.adjusted_time AND p.site_id = g.site_id
        GROUP BY p.block, p.adjusted_time, g.ground_generation, g.ground_ghi, g.ground_poa
        ORDER BY p.adjusted_time ASC, p.block ASC;
        
`, [siteId, formattedStartDate, formattedEndDate])

        const results = query.rows

        if (results.length === 0) {
            res.send("No Data Found")
            return
        }

        const json2csvParser = new Parser()
        const csvData = json2csvParser.parse(results)

        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename=forecast.csv')
        res.send(csvData)

    } catch (err) {
        console.log(err);
        next(err);
    }
})



sitesRoute.get('/getCombinedForecast', async (req, res, next) => {
    try {
        // Extract query parameters
        const { startDate, endDate, givenDate, site, client } = req.query;

        //get givenDate + 1 Date object
        const givenDatePlusOne = new Date(givenDate)

        givenDatePlusOne.setDate(givenDatePlusOne.getDate() + 1)

        //convert the givenDatePlusOne to this format: Tue Oct 30 2023 00:00:00 GMT 0530 (India Standard Time)

        const givenDatePlusOneFormatted = givenDatePlusOne.toString()



        // Fetch data from /getForecast
        const firstRange = await axios.get(`https://testapis.solarad.ai/dashboard/sites/getForecast?startDate=${startDate}&endDate=${givenDatePlusOneFormatted}&site=${site}&client=${client}`);
        const firstRangeData = firstRange.data;
        // Fetch data from /getForecastFromDb
        const secondRange = await axios.get(`https://testapis.solarad.ai/dashboard/sites/getForecastFromDb?startDate=${givenDatePlusOne}&endDate=${endDate}&site=${site}&client=${client}`);
        const secondRangeData = secondRange.data;
        // Merge the data
        const combinedData = await mergeCsvStrings(firstRangeData, secondRangeData);


        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=combined_forecast.csv`);
        res.send(combinedData);
    } catch (err) {
        console.log(err);
        next(err);
    }
});

async function mergeCsvStrings(csv1, csv2) {
    // Split the CSV into lines
    const lines1 = csv1.split('\n');
    const lines2 = csv2.split('\n');

    // Check if there is any data
    if (lines1.length === 0) return csv2;
    if (lines2.length === 0) return csv1;

    // Assuming the first line contains headers, and they are the same for both CSVs
    const headers1 = lines1[0];
    const data1 = lines1.slice(1);
    const data2 = lines2.slice(1); // Skipping headers from the second CSV

    // Merge the data
    const combinedData = [headers1, ...data1, ...data2].join('\n');
    return combinedData;
}




//done
//done
sitesRoute.get('/get-utility-sites', async (req, res) => {
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
sitesRoute.get('/get-residential-sites', async (req, res) => {
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
sitesRoute.get('/get-all-sites', async (req, res) => {
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
sitesRoute.get('/convertHourlyToDailyOpenMeteo', async (req, res, next) => {
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

//test done
function convertToCsv(data) {
    const header = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map((row) => Object.values(row).join(',') + '\n');
    return header + rows.join('');
}


module.exports = {
    sitesRoute,
    convertToCsv
}



