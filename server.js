const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const fileSystem = require("fs");
const bcrypt = require("bcrypt");
const csv = require('csv-parser');
const pool = require('./db');
const cors = require("cors");

app.use(cors());

app.get("/health", (req, res) => {
  res.sendStatus(200);
});

app.get("/fenice", async (req, res) => {
  let providedApiKey = req.header("api_key");
  const storedApiKey = process.env.API_KEY;
  bcrypt.compare(providedApiKey, storedApiKey, (err, result) => {
    if (result) {
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

        // Read and process the CSV file
        const results = [];
        let columnExists = false;
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
      }
      catch (error) {
        res.send(`No such file or directory exists - ${filePath}`);
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

    if(config.rowCount === 0){
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
      
  } catch (error) {
    console.log(error.message);
  }
})




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
