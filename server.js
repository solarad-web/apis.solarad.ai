const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const fileSystem = require("fs");
const papa = require('papaparse');
const moment = require('moment-timezone');
const bcrypt = require("bcrypt");
const csv = require('csv-parser');
const pool = require('./db');
const cors = require("cors");

app.use(cors());


app.get("/health", (req, res) => {
  res.sendStatus(200);
})

app.get("/fenice", async (req, res) => {
  ``
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
              delete data[`ENTRY_TIME`];
              results.push(data);
            })
            .on('end', () => {
              const modifiedCsv = columnExists ? convertToCsv(results) : fileSystem.readFileSync(filePath);
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
    const config = await pool.query("SELECT * FROM emaillist WHERE user_email = $1", [email]);

    if (config.rowCount === 0) {
      res.json("Email Not Present");
      return;
    }

    const gen_forecast = config.rows[0].generation_forecast;
    const ghi_graph = config.rows[0].ghi_graph;
    const poa_graph = config.rows[0].poa_graph;
    const monthly_ts = config.rows[0].monthly_ts;
    const weather_insights = config.rows[0].weather_insights;

    res.json({ "gen_forecast": gen_forecast, "ghi_graph": ghi_graph, "poa_graph": poa_graph, "monthly_ts": monthly_ts, "weather_insights": weather_insights });
  } catch (error) {
    console.log(error.message);
    res.send(error.message);
    return;
  }
});


app.get('/getGraphData', async (req, res) => {
  try {
    var filePath = req.query.endpoint;
    var stat = fileSystem.statSync(`home/csv/${filePath}`);

    res.set(
      "Content-Disposition",
      `attachment; filename=graphData.csv`
    );
    res.set("Content-Type", "text/csv");
    res.set("Content-Length", stat.size);

    fileSystem.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Error reading the CSV file.' });
      }

      // Parse the CSV data with header: true to get headers as an array
      const parsedData = papa.parse(data, { header: true });

      // Rename the 'Time' column to 'Date'
      const updatedHeader = parsedData.meta.fields.map((header) => {
        return header === 'Time' ? 'Date' : header;
      });

      // Determine the server's local timezone
      const localTimezone = moment.tz.guess();

      // Update the 'Time' column to 'Date' and convert to the local timezone
      const updatedData = parsedData.data.map((row) => {
        const utcTime = moment.utc(row.Time, 'YYYY-MM-DD HH:mm:ss');
        const localTime = utcTime.tz(localTimezone);
        row.Date = localTime.format('YYYY-MM-DD HH:mm:ss'); // Rename 'Time' to 'Date'
        delete row.Time; // Remove the 'Time' column from the data
        return row;
      });

      // Convert the updated data back to CSV format with the updated header
      const csvFile = papa.unparse({ fields: updatedHeader, data: updatedData });
      res.send(csvFile);
    });
  } catch (error) {
    res.status(500).json({ error: 'Error processing the CSV file.' });
  }
});




// Helper function to convert data to CSV format
function convertToCsv(data) {
  const header = Object.keys(data[0]).join(',') + '\n';
  const rows = data.map((row) => Object.values(row).join(',') + '\n');
  return header + rows.join('');
}


const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || `localhost`;

app.listen(PORT, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
