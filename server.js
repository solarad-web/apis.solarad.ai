const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const axios = require('axios')
const csv = require('csv-parser');
const fileSystem = require("fs");
const pool = require("./config/db");

//Enable cors
const cors = require("cors");
app.use(cors());


//get All Routes
const fenice = require('./routes/fenice');
const dashboardData = require('./routes/DashboardAPIs/sites');
const dashboardLogin = require('./routes/DashboardAPIs/auth');
const dashboardAdmin = require('./routes/DashboardAPIs/admin')

//health API
app.get("/health", (req, res) => {
  res.sendStatus(200);
})


//use api routes
app.use("/fenice", fenice);
app.use("/dashboard/sites", dashboardData);
app.use("/dashboard/auth", dashboardLogin);
app.use("/dashboard/admin", dashboardAdmin);


//Check if Live Data and Forecast are available

async function checkLiveAndForecastAvailability() {

  const query = await pool.query(`SELECT * FROM utility_sites`)
  const sites = query.rows

  await checkLiveAvailability(sites)
  await checkForecastAvailability(sites)

}

async function checkLiveAvailability(allSites) {

  const missingSites = []

  for (let i = 0; i < allSites.length; i++) {
    const timeframes = ['Daily', 'Monthly', 'Subhourly', 'Hourly']
    // Check if the row has the company name
    for (let j = 0; j < timeframes.length; j++) {
      let filepath = `/home/csv/${allSites[i].company}/${timeframes[j].toLowerCase()}/Solarad_${allSites[i].sitename}_${allSites[i].company}_${timeframes[j]}.csv`;

      if (!fileSystem.existsSync(filepath)) {
        missingSites.push({
          'company': allSites[i].company,
          'site': allSites[i].sitename,
          'timeframe': timeframes[j]
        })
      }
    }
  }

  for (let i = 0; i < missingSites.length; i++) {
    const message = {
      channel: 'C05MA66MUJU',
      attachments: [
        {
          color: '#FF0000', // Red color in hexadecimal
          text: `Alert From The Node Server: Live Data File Not Found : ${missingSites[i].company} - ${missingSites[i].site} - ${missingSites[i].timeframe}`,

        },
      ],
    };
    if (missingSites.length > 0) {
      axios.post(process.env.SLACK_WEBHOOK, message)
        .catch(err => { console.log(err); return });

    }
  }
}

async function checkForecastAvailability(allSites) {

  const missingSites = [];

  for (let i = 0; i < allSites.length; i++) {
    if (allSites[i].show_forecast === 'True') {
      let date = new Date();
      let year = date.getFullYear();
      let month = date.getMonth() + 1;
      if (month < 10) month = `0${month}`;
      let day = date.getDate();
      if (day < 10) day = `0${day}`;
      // Check if the allSites[i] has the company name
      let filepath = `/home/Forecast/${allSites[i].company}/forecasts/Solarad_${allSites[i].sitename}_${allSites[i].company}_Forecast_${year}-${month}-${day}_ID.csv`;
      if (!fileSystem.existsSync(filepath)) {
        missingSites.push({
          'company': allSites[i].company,
          'site': allSites[i].sitename,
          'date': `${year}-${month}-${day}`
        });
      }
    }
  }

  for (let i = 0; i < missingSites.length; i++) {
    const message = {
      channel: 'C05MA66MUJU',
      attachments: [{
        color: '#FF0000', // Red color in hexadecimal
        text: `Alert From The Node Server: Forecast Data File Not Found : ${missingSites[i].company} - ${missingSites[i].site} - ${missingSites[i].date}`,
      }],

    };
    if (missingSites.length > 0) {
      axios.post(process.env.SLACK_WEBHOOK, message)
        .catch(err => { console.log(err); return });
    }
  }
}


// // Call the function immediately when the program starts
// checkLiveAndForecastAvailability();

// // Set an interval to run the function every hour
// setInterval(checkLiveAndForecastAvailability, 3600000);



//<--business logic code ends here-->


// route not found middleware
app.use((req, res, next) =>
  res.status(404).send("You are looking for something that we do not have!")
);

//error handler middleware
app.use((err, req, res, next) => {
  res.status(500).send("Something went wrong! Please try after some time.");
});


const PORT = process.env.PORT || 80;
const HOST = process.env.HOST || `localhost`;

app.listen(PORT, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
