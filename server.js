const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const fileSystem = require("fs");
const bcrypt = require("bcrypt");
const csv = require('csv-parser');
const pool = require('./db');
const cors = require("cors");
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { pipeline } = require('stream');
const { sendMagicLinkEmail } = require("./mailer");

app.use(cors());

app.get("/health", (req, res) => {
  res.sendStatus(200);
})

app.get("/fenice", async (req, res) => {
  let providedApiKey = req.header("api_key");
  const storedApiKey = process.env.API_KEY;
  bcrypt.compare(providedApiKey, storedApiKey, (err, result) => {
    if (result) {
      try {
        try {
          let site_id = req.query.site_id;
          var filePath = `/home/Fenice/site_${site_id}.csv`;
          var stat = fileSystem.statSync(filePath);

          res.set(
            "Content-Disposition",
            `attachment; filename=site_${site_id}.csv`
          );
          res.set("Content-Type", "text/csv");
          res.set("Content-Length", stat.size);

        } catch (err) {
          res.send(err.message);
          return;
        }
        // Read and process the CSV file
        const results = [];
        const noChangeResults = [];
        let columnExists = false;
        try {
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
              noChangeResults.push(data);
              delete data[`ENTRY_TIME`];
              results.push(data);
            })
            .on('end', () => {
              const modifiedCsv = columnExists ? convertToCsv(results) : convertToCsv(noChangeResults);
              // Create a new CSV file with modified data

              // Send back the modified CSV file
              res.send(modifiedCsv);
            });
        } catch (err) {
          res.send(err.message);
          return;
        }
      }
      catch (error) {
        res.send(error.message);
        return;
      }
    } else {
      res.status(401).send("Unauthorized");
    }
  });
});


app.get("/getgraphsconfig", async (req, res) => {
  try {
    // Make an HTTP request to the external API
    const apiResponse = await axios.get('https://gm33of7aig.execute-api.ap-south-1.amazonaws.com/dev/get-utility-sites');
    console.log(apiResponse.data);

    const csvData = [];

    pipeline(
      apiResponse.data,
      csv(),
      (err) => {
        if (err) {
          console.error('Error parsing CSV data:', err);
          res.status(500).json({ error: 'Failed to read CSV data' });
        } else {
          res.json(csvData); // Send the parsed CSV data as the response
        }
      }
    );

    csv()
      .on('data', (row) => {
        csvData.push(row);
      });

    console.log(csvData);

    // Pipe the CSV data to a file stream;
    // const fileStream = fs.createWriteStream('data.csv');
  } catch (error) {
    console.log(error.message);
    res.send(error.message);
  }

  //   const gen_forecast = config.rows[0].generation_forecast;
  //   const ghi_graph = config.rows[0].ghi_graph;
  //   const poa_graph = config.rows[0].poa_graph;
  //   const monthly_ts = config.rows[0].monthly_ts;
  //   const weather_insights = config.rows[0].weather_insights;
  //   const sites = config.rows[0].sites;
  //   const conSites = config.rows[0].consolidated_sites;

  //   res.json({
  //     "gen_forecast": gen_forecast,
  //     "ghi_graph": ghi_graph,
  //     "poa_graph": poa_graph,
  //     "monthly_ts": monthly_ts,
  //     "weather_insights": weather_insights,
  //     "sites": sites,
  //     "consolidated_sites": conSites
  //   });

  // } catch (error) {
  //   console.log(error.message);
  //   res.send(error.message);
  //   return;
  // }
});


app.get('/getGraphData', async (req, res) => {
  try {
    var client = req.query.client;
    var site = req.query.site;
    var timeframe = req.query.timeframe;
    var filepath = `/home/csv/${client}/${timeframe.toLowerCase()}/Solarad_${site}_${client}_${timeframe}_UTC.csv`;
    try {
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
      res.send(err.message);
      return;
    }
  } catch (err) { res.send(err.message) }
});


app.get("/signUp", async (req, res) => {
  const email = req.query.email;
  const fname = req.query.fname;
  const lname = req.query.lname;
  const pwd = req.query.pwd;
  const company = req.query.company;

  try {
    const data = await pool.query(`SELECT * FROM user_details WHERE user_email = $1`, [email]);

    if (data.rowCount != 0) {
      res.send("Email Present");
      return;
    }

    const token = jwt.sign({ email: email, fname: fname, lname: lname, pwd: pwd, company: company }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    })
    await sendMagicLinkEmail({ email: email, token: token, fname: fname });
    res.status(200).send('Email Sent');
  } catch (error) {
    console.log(error.message)
    res.status(500).send(error.message);
  }
})

app.get("/signIn", async (req, res) => {
  const email = req.query.email;
  const providedPwd = req.query.pwd;


  //get passhash from postgres

  const data = await pool.query(`SELECT * FROM user_details WHERE user_email = $1`, [email]);

  if (data.rowCount === 0) {
    res.send("Email Not Present");
    return;
  }

  const storedPassHash = data.rows[0].passhash;

  try {
    bcrypt.compare(providedPwd, storedPassHash, (err, result) => {
      if (result) {
        res.status(200).send('Valid');
      }
      else res.status(401).send('Invalid');
    });

  } catch (err) {
    res.status(500).send("Something Went Wrong!");
  }
})

app.get("/verify", async (req, res) => {
  const token = req.query.token;
  if (token == null) return res.sendStatus(401);

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const email = decodedToken.email;
    const fname = decodedToken.fname;
    const lname = decodedToken.lname;
    const pwd = decodedToken.pwd;
    const passhash = await generateHash(pwd);
    const company = decodedToken.company;

    await pool.query(`INSERT INTO user_details (user_email, user_fname, user_lname, company, passhash)
    VALUES ($1, $2, $3, $4, $5)`, [email, fname, lname, company, passhash]);

    res.send("Email Verified! You can log In to your account now.");

  } catch (error) {
    res.send(error.message);
  }
});






// Helper function to convert data to CSV format
function convertToCsv(data) {
  const header = Object.keys(data[0]).join(',') + '\n';
  const rows = data.map((row) => Object.values(row).join(',') + '\n');
  return header + rows.join('');
}

//generate hash value for password
async function generateHash(password) {
  try {
    const salt = await bcrypt.genSalt(11);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    console.log(error.message);
    throw new Error('Hash generation failed');
  }
}


const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || `localhost`;

app.listen(PORT, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
