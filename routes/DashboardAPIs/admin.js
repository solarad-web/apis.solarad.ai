const Router = require("express");
const route = Router();

const dotenv = require("dotenv");
dotenv.config();

route.get("/getConfig", async (req, res, next) => {
    try {

        let company = req.query.company;

        // Make an HTTP request to the external API
        let filepath = `/home/utility-sites`;


        const sites = [];

        // Check if the file exists
        if (!fileSystem.existsSync(filepath)) {
            res.send("File not found");
            return; // Exit the function early
        }

        // Process the CSV data
        fileSystem.createReadStream(filepath)
            .pipe(csv())
            .on('data', (row) => {
                if (row.company === company) {
                    sites.push({
                        'company': row.company,
                        'site': row.sitename,
                        'ground_data_available': row.ground_data_available,
                        'show_ghi': row.show_ghi,
                        'show_poa': row.show_poa,
                        'show_forecast': row.show_forecast,
                        'lat': row.lat,
                        'lon': row.lon
                    });
                }
            })
            .on('end', () => {
                res.send(sites); // Send the filtered CSV data as the response
            });

    }
    catch (err) {
        console.log(err);
        next(err);
    }
})

module.exports = route;