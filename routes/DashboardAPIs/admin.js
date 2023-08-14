const Router = require("express");
const route = Router();
const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const fileSystem = require("fs");
const csv = require('csv-parser');
const pool = require("../../config/db");
route.use(express.json());

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

route.post("/add-site", async (req, res, next) => {
    try {
        const data = req.body;

        let company = data.company;
        let sitename = data.sitename;
        let ground_data_available = data.ground_data_available;
        let show_ghi = data.show_ghi;
        let ele = data.ele;
        let show_poa = data.show_poa;
        let show_forecast = data.show_forecast;
        let lat = data.lat;
        let lon = data.lon;
        let country = data.country;
        let timezone = data.timezone;
        let capacity = data.capacity;
        let mount_config = data.mount_config;
        let tilt_angle = data.tilt_angle;

        //create a query to check if the site already exists in utility_sites table
        //execute the query using pool
        const { rows } = await pool.query(`SELECT * FROM utility_sites WHERE company=$1 AND sitename=$2`, [company, sitename]);

        if (rows.length > 0) {
            res.send("Site already exists");
            return;
        }

        //create a query to insert the site into utility_sites table
        //execute the query using pool
        await pool.query(`INSERT INTO utility_sites (company, sitename, ground_data_available, show_ghi, ele, show_poa, show_forecast, lat, lon, timezone, capacity, country, mount_config, tilt_angle) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10 , $11, $12, $13, $14)`,
            [company, sitename, ground_data_available, show_ghi, ele, show_poa, show_forecast, lat, lon, timezone, capacity, country, mount_config, tilt_angle]);

        res.send('Site added successfully');
    }
    catch (err) {
        console.log(err);
        next(err);
    }
})

route.get("/findSite", async (req, res, next) => {
    try {
        const site = req.query.site;
        const company = req.query.company;

        //create a query to check if the site exists in utility_sites table and then send the data of that site in an object
        //execute the query using pool
        const { rows } = await pool.query(`SELECT * FROM utility_sites WHERE company=$1 AND sitename=$2`, [company, site]);

        if (rows.length === 0) {
            res.send("Site not found");
            return;
        }

        res.send(rows[0]);
    }
    catch (err) {
        console.log(err);
        next(err);
    }
})

route.post("/updateSite", async (req, res, next) => {
    try {
        const data = req.body;

        let company = data.company;
        let sitename = data.sitename;
        let ground_data_available = data.ground_data_available;
        let show_ghi = data.show_ghi;
        let ele = data.ele;
        let show_poa = data.show_poa;
        let show_forecast = data.show_forecast;
        let lat = data.lat;
        let lon = data.lon;
        let country = data.country;
        let timezone = data.timezone;
        let capacity = data.capacity;
        let mount_config = data.mount_config;
        let tilt_angle = data.tilt_angle;

        //create a query to update the site in utility_sites table
        //execute the query using pool
        await pool.query(`UPDATE utility_sites SET ground_data_available=$1, show_ghi=$2, ele=$3, show_poa=$4, show_forecast=$5, lat=$6, lon=$7, timezone=$8, capacity=$9, country=$10, mount_config=$11, tilt_angle=$12 WHERE company=$13 AND sitename=$14`,
            [ground_data_available, show_ghi, ele, show_poa, show_forecast, lat, lon, timezone, capacity, country, mount_config, tilt_angle, company, sitename]);

        res.send('Site updated successfully');

    }
    catch (err) {
        console.log(err);
        next(err);
    }
})

route.get("/deleteSite", async (req, res, next) => {
    try {
        const site = req.query.site;
        const company = req.query.company;

        //create a query to check if the site exists in utility_sites table
        //execute the query using pool
        const { rows } = await pool.query(`SELECT * FROM utility_sites WHERE company=$1 AND sitename=$2`, [company, site]);

        if (rows.length === 0) {
            res.send("Site not found");
            return;
        }

        //create a query to delete the site from utility_sites table
        //execute the query using pool
        await pool.query(`DELETE FROM utility_sites WHERE company=$1 AND sitename=$2`, [company, site]);

        res.send('Site deleted successfully');
    }
    catch (err) {
        console.log(err);
        next(err);
    }
})




module.exports = route;