const Router = require("express");
const route = Router();
const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const bcrypt = require("bcrypt");
const pool = require("../../config/db");
route.use(express.json())
const { sendMagicLinkEmailByAdmin } = require("../../services/mailer");

//done
//done
route.get('/getCompanies', async (req, res, next) => {
    try {
        const row = await pool.query(`SELECT company FROM companies`);

        const companies = row.rows.map(company => company.company);

        res.send(companies);
    }
    catch (err) {
        console.log(err);
        next(err);
    }
})

//done
//done
route.get("/getConfig", async (req, res, next) => {
    try {
        let company = req.query.company;
        const query = await pool.query(`SELECT * FROM utility_sites WHERE company=$1 AND show_dashboard=$2`, [company, true])
        const companySites = query.rows

        res.send(companySites);

    }
    catch (err) {
        console.log(err);
        next(err);
    }
})

//done
//done
route.post("/add-site", async (req, res, next) => {
    try {
        const data = req.body;

        let company = data.company;
        let sitename = data.sitename;
        let state = data.state;
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
        let tilt_angle = String(data.tilt_angle);
        tilt_angle = tilt_angle.split(',').map(angle => parseFloat(angle))

        const { rows } = await pool.query(`SELECT * FROM utility_sites WHERE company=$1 AND sitename=$2`, [company, sitename]);

        if (rows.length > 0) {
            res.send("Site already exists");
            return;
        }

        await pool.query(`INSERT INTO utility_sites (company, sitename, ground_data_available, show_ghi, ele, show_poa, show_forecast, lat, lon, timezone, capacity, country, mount_config, tilt_angle, state) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10 , $11, $12, $13, $14, $15)`,
            [company, sitename, ground_data_available, show_ghi, ele, show_poa, show_forecast, lat, lon, timezone, capacity, country, mount_config, tilt_angle, state])

        const siteIdResult = await pool.query(`SELECT id FROM utility_sites WHERE company=$1 AND sitename=$2`, [company, sitename]);
        const siteId = siteIdResult.rows[0].id;

        await pool.query(`INSERT INTO rev_mailer_configs(site_id) VALUES($1)`, [siteId]);
        res.send('Site added successfully')
    }
    catch (err) {
        console.log(err)
        next(err)
    }
})

//done
//done
route.get("/findSite", async (req, res, next) => {
    try {
        const site = req.query.site;
        const company = req.query.company;

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

//done
//done
route.post("/updateSite", async (req, res, next) => {
    try {
        const data = req.body;
        let site_id = data.id;
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
        let tilt_angle = String(data.tilt_angle);
        let state = data.state;


        let forecast_graphs = data.forecast_graphs;
        let historical_graphs = data.historical_graphs;

        const forecastGraphs = JSON.stringify(forecast_graphs);

        const historicalGraphs = JSON.stringify(historical_graphs);
        console.log(historicalGraphs)
        tilt_angle = tilt_angle.split(',').map(angle => parseFloat(angle))


        await pool.query(`UPDATE utility_sites SET ground_data_available=$1, show_ghi=$2, ele=$3, show_poa=$4, show_forecast=$5, lat=$6, lon=$7, timezone=$8, capacity=$9, country=$10, mount_config=$11, tilt_angle=$12, company=$13, sitename=$14, forecast_graphs=$15, historical_graphs=$16, state=$17 WHERE id=$18 `,
            [ground_data_available, show_ghi, ele, show_poa, show_forecast, lat, lon, timezone, capacity, country, mount_config, tilt_angle, company, sitename, forecastGraphs, historicalGraphs, state, site_id]);

        res.send('Site updated successfully');

    }
    catch (err) {
        console.log(err);
        next(err);
    }
})


//done
//done
route.get("/deleteSite", async (req, res, next) => {
    try {
        const site = req.query.site;
        const company = req.query.company;

        const { rows } = await pool.query(`SELECT * FROM utility_sites WHERE company=$1 AND sitename=$2`, [company, site]);

        if (rows.length === 0) {
            res.send("Site not found");
            return;
        }

        const query = await pool.query("SELECT id from utility_sites where company=$1 AND sitename=$2", [company, site]);

        const siteID = query.rows[0].id;
        await pool.query(`DELETE FROM rev_mailer_configs WHERE site_id=$1`, [siteID]);
        await pool.query(`DELETE FROM utility_sites WHERE company=$1 AND sitename=$2`, [company, site]);

        res.send('Site deleted successfully');
    }
    catch (err) {
        console.log(err);
        next(err);
    }
})

//done
//done
route.get("/addUser", async (req, res, next) => {
    try {
        const email = req.query.email;
        const company = req.query.company;
        const fname = req.query.fname;
        const lname = req.query.lname;
        const pwd = company.toLowerCase();
        const passhash = await generateHash(pwd);

        const user = await pool.query(`SELECT * FROM user_details WHERE user_email=$1`, [email]);

        if (user.rows.length > 0) {
            res.send("User already exists");
            return;
        }
        await pool.query(`INSERT INTO user_details (user_email, user_fname, user_lname, company, passhash)
        VALUES ($1, $2, $3, $4, $5)`, [email, fname, lname, company, passhash]);

        await sendMagicLinkEmailByAdmin({ email: email, password: pwd, fname: fname });
        res.status(200).send('Email Sent');

    }
    catch (err) {
        console.log(err);
        next(err);
    }
})

//done
//done
route.get('/updateUser', async (req, res, next) => {
    try {
        const email = req.query.email;
        const company = req.query.company;

        //if email doesnt exists res.send('Email doesn't exists')
        const user = await pool.query(`SELECT * FROM user_details WHERE user_email=$1`, [email]);

        if (user.rows.length === 0) {
            res.send("User doesn't exists");
            return;
        }

        await pool.query(`UPDATE user_details SET company=$1 WHERE user_email=$2`, [company, email]);

        res.send('User updated successfully');
    }
    catch (err) {
        console.log(err);
        next(err);
    }
})


//done
//done
//get foldername for curr date
route.get('/getFolderCurrDate', async (req, res, next) => {
    try {
        const company = req.query.company;
        const sitename = req.query.sitename;
        if (company === 'Demo' && sitename === 'Demo-Site') {
            res.send('ml_forecasts');
            return;
        }
        const rows = await pool.query(`SELECT forecast_type FROM utility_sites WHERE sitename=$1 AND company=$2`, [sitename, company]);
        res.send(rows.rows[0].forecast_type);
    }
    catch (err) {
        console.log(err);
        next(err);
    }
})

//done
//done
route.get('/updateFolderCurrDate', async (req, res, next) => {
    try {
        const folder = req.query.folder;
        const sitename = req.query.sitename;
        const company = req.query.company;

        await pool.query(`UPDATE utility_sites SET forecast_type=$1 WHERE sitename=$2 AND company=$3`, [folder, sitename, company]);
        console.log('Foldername updated successfully');
    }
    catch (err) {
        console.log(err);
        next(err);
    }
})


//done
//done
route.get('/addNewCompany', async (req, res, next) => {
    try {
        const company = req.query.company;

        await pool.query(`INSERT INTO companies (company) VALUES ($1)`, [company]);
        res.send({message: 'Company added Successfully', statusCode: 200});
    }
    catch(err) {
        console.log(err)
        res.status(200).send({message: 'Company already exists', statusCode: 400});
        // next(err)
    }
})

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





module.exports = route;