const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const fileSystem = require("fs");
const bcrypt = require("bcrypt");
const csv = require('csv-parser');

app.get("/health", (req, res) => {
  res.sendStatus(200);
});

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
