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
const { Readable } = require('stream');
const { sendMagicLinkEmail, sendResetPasswordLink } = require("./mailer");

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

          fileSystem.access(filePath, fileSystem.constants.F_OK, (err) => {
            if (err) {
              // If the file doesn't exist, respond with an appropriate message
              res.status(404).send('Filepath does not exist.');
              return;
            }
          })

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
    res.status(500).json({ error: 'Failed to fetch data from the API' });
  }
});


app.get('/getGraphData', async (req, res) => {
  try {
    var client = req.query.client;
    var site = req.query.site;
    var timeframe = req.query.timeframe;
    var filepath = `/home/csv/${client}/${timeframe.toLowerCase()}/Solarad_${site}_${client}_${timeframe}_UTC.csv`;

    // Check if the file exists
    fileSystem.access(filepath, fileSystem.constants.F_OK, (err) => {
      if (err) {
        // If the file doesn't exist, respond with an appropriate message
        res.status(404).send('Filepath does not exist.');
        return;
      }
    })

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
  } catch (err) { res.send(err.message); return; }
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
    console.log(error.message);
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


app.get('/forgotPassword', async (req, res) => {
  try {
    const email = req.query.email;

    const data = await pool.query(`SELECT * FROM user_details WHERE user_email = $1`, [email]);

    if (data.rowCount === 0) {
      res.send("Email Not Present");
      return;
    }

    await sendResetPasswordLink({ email: email });
    res.send("Email Sent");
  } catch (error) {
    res.send(err.message);
    return;
  }
})





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
