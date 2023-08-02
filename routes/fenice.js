const Router = require("express");
const route = Router();

const dotenv = require("dotenv");
dotenv.config();

const fileSystem = require("fs");
const csv = require('csv-parser');
const bcrypt = require("bcrypt");




route.get("/", async (req, res, next) => {
    let providedApiKey = req.header("api_key");
    const storedApiKey = process.env.API_KEY;


    try {
        bcrypt.compare(providedApiKey, storedApiKey, (err, result) => {
            if (result) {
                let site_id = req.query.site_id;
                var filePath = `/home/Fenice/site_${site_id}.csv`;

                // Check if the file exists
                if (!fileSystem.existsSync(filePath)) {
                    res.status(404).send("File not found");
                    return; // Exit the function early
                }

                var stat = fileSystem.statSync(filePath);

                res.set(
                    "Content-Disposition",
                    `attachment; filename=site_${site_id}.csv`
                );
                res.set("Content-Type", "text/csv");
                res.set("Content-Length", stat.size);

                // Read and process the CSV file
                const results = [];
                const unchangedResults = [];
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
                        unchangedResults.push(data);
                        delete data[`ENTRY_TIME`];
                        results.push(data);
                    })
                    .on('end', () => {
                        const modifiedCsv = columnExists? convertToCsv(results) : convertToCsv(unchangedResults);
                        res.send(modifiedCsv)
                    });
            } else {
                res.status(401).send("Unauthorized");
            }
        });
    }
    catch (err) {
        console.log(err.message);
        next(err);
    }
});




// Helper function to convert data to CSV format
function convertToCsv(data) {
    if (!data || data.length === 0) {
        return '';
    }
    const header = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map((row) => Object.values(row).join(',') + '\n');
    return header + rows.join('');
}


module.exports = route;