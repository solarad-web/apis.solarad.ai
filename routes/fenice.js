const Router = require("express");
const feniceRoute = Router();
const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION
});

const { S3 } = AWS;
const fileSystem = require("fs");
const csv = require('csv-parser');
const bcrypt = require("bcrypt");
const pool = require("../config/db");

const fastcsv = require('fast-csv');

const s3 = new S3();
feniceRoute.use(express.json());

//done

const isFutureTime = (timeString) => {
  const time = new Date(timeString);
  const now = new Date();
  return time > now;
};

//test done
const generateTodayDateString = () => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
};

//test done
const processCsvData = (s3Params, lastNRows, queryDate) => {
  const results = [];
  const unchangedResults = [];
  let columnExists = false;
  console.log(queryDate)
  return new Promise((resolve, reject) => {
    s3.getObject(s3Params).createReadStream()
      .pipe(csv())
      .on('headers', (headers) => {
        if (headers.includes('ENTRY_TIME')) {
          columnExists = true;
        }
      })
      .on('data', (data) => {
        if (!isFutureTime(data['Time'])) {
          if (lastNRows !== undefined) {
            unchangedResults.push(data);
            if (unchangedResults.length > lastNRows) {
              unchangedResults.shift();
            }

            if (columnExists) {
              delete data['ENTRY_TIME'];
            }
            results.push(data);
            if (results.length > lastNRows) {
              results.shift();
            }
          } else if (queryDate === undefined || data['Time'].includes(queryDate)) {
            unchangedResults.push(data);
            if (columnExists) {
              delete data['ENTRY_TIME'];
            }
            results.push(data);
          }
        }
      })
      .on('end', () => {
        const modifiedCsv = columnExists ? convertToCsv(results) : convertToCsv(unchangedResults);
        resolve(modifiedCsv);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

feniceRoute.get('/', async (req, res, next) => {
  try {
    let providedApiKey = req.header('api_key');
    let queryDate = req.query.date;
    let lastNRows = req.query.last_n_values;

    if (queryDate === 'today') {
      const todayDateString = generateTodayDateString();
      queryDate = todayDateString;
    }

    const storedApiKey = process.env.API_KEY
    const apiKeyResult = await checkApiKey(providedApiKey, storedApiKey)

    if (apiKeyResult) {
      const site_id = req.query.site_id
      const filePath = `csv/clients/Fenice/subhourly/site_${site_id}.csv`

      const s3Bucket = 'solarad-output'
      const s3Params = { Bucket: s3Bucket, Key: filePath }
      const s3Object = await s3.getObject(s3Params).promise();

      if (!s3Object.Body) {
        res.status(404).send('File not found');
        return;
      }

      const modifiedCsv = await processCsvData(s3Params, lastNRows, queryDate);

      res.set('Content-Disposition', `attachment; filename=site_${site_id}.csv`);
      res.set('Content-Type', 'text/csv');
      res.send(modifiedCsv);
    } else {
      res.status(401).send('Unauthorized');
    }
  } catch (err) {
    console.log(err);
    next(err);
  }
});






//test done
// Function to fetch data from the database
async function fetchResidentialSites(client) {
  try {
    const queryResult = await pool.query('SELECT * FROM residential_sites WHERE company = $1', [client]);
    return queryResult.rows;
  } catch (error) {
    throw error;
  }
}

// Function to generate CSV
//test done
function generateCSV(rows) {
  const headers = [
    'sitename', 'company', 'lat', 'lon', 'ele',
    'capacity', 'country', 'timezone', 'mount_config',
    'tilt_angle', 'ground_data_available'
  ];

  const csvStream = fastcsv.format({ headers: true });

  csvStream.write(headers);

  rows.forEach(row => csvStream.write(row));
  csvStream.end();

  return csvStream;
}


feniceRoute.get('/export-csv', async (req, res) => {
  try {
    const data = await fetchResidentialSites('Fenice');
    const csvStream = generateCSV(data);

    res.setHeader('Content-Disposition', 'attachment; filename="residential_sites.csv"');
    res.setHeader('Content-Type', 'text/csv');

    csvStream.pipe(res);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

//test done
async function checkApiKey(apiKey, storedApiKey) {
  if (apiKey === null || apiKey === undefined || typeof (apiKey) !== 'string') {
    return false;
  }
  if (storedApiKey === null || storedApiKey === undefined || typeof (storedApiKey) !== 'string') {
    return false;
  }
  return bcrypt.compare(apiKey, storedApiKey);
}


//test done
async function insertOrUpdateSite(req) {
  try {
    const {
      sitename,
      company = "Fenice",
      lat = 27,
      lon = 78,
      ele = 0,
      capacity = 0,
      country = "India",
      timezone = "Asia/Kolkata",
      mount_config = "None",
      tilt_angle = "0",
      ground_data_available = "False",
    } = req.body;

    const existingSite = await pool.query(`
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

    if (existingSite.rows.length > 0) {
      return "Site with these details already exists";
    }

    const latLonrows = await pool.query(`SELECT * FROM residential_sites WHERE lat = $1 AND lon = $2`, [lat, lon]);

    if (latLonrows && latLonrows.rows.length > 0) {
      await pool.query(`UPDATE residential_sites SET sitename = $1, company = $2, lat = $3, lon = $4, ele = $5, capacity = $6, country = $7, timezone = $8, mount_config = $9, tilt_angle = $10, ground_data_available = $11 WHERE lat = $3 AND lon = $4`,
        [sitename, company, lat, lon, ele, capacity, country, timezone, mount_config, tilt_angle, ground_data_available]);

      return "Site updated successfully";
    } else {
      await pool.query(`INSERT INTO residential_sites (sitename,  company, lat, lon, ele, capacity, country, timezone, mount_config, tilt_angle, ground_data_available)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [sitename, company, lat, lon, ele, capacity, country, timezone, mount_config, tilt_angle, ground_data_available]);

      return "Site added successfully";
    }
  } catch (error) {
    throw error;
  }
}


feniceRoute.post('/add-site', async (req, res) => {
  const providedApiKey = req.header("api_key");

  try {
    const storedApiKey = process.env.API_KEY;
    const isApiKeyValid = await checkApiKey(providedApiKey, storedApiKey);

    if (isApiKeyValid) {
      const resultMessage = await insertOrUpdateSite(req);
      res.send(resultMessage);
    } else {
      res.status(401).send("Unauthorized");
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});


//test done
function convertToCsv(data) {
  if (!data || data.length === 0) {
    return '';
  }
  const header = [Object.keys(data[0]).join(',') + '\n'];
  const rows = data.map((row) => [Object.values(row).join(',') + '\n']);
  return header.join('') + rows.join('');
}


module.exports = {
  feniceRoute,
  convertToCsv,
  insertOrUpdateSite,
  checkApiKey,
  generateCSV,
  fetchResidentialSites,
  processCsvData,
  generateTodayDateString,
  isFutureTime
};