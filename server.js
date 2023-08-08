const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const axios = require('axios')
const { Readable } = require('stream');
const csv = require('csv-parser');
const fileSystem = require("fs");


//Enable cors
const cors = require("cors");
app.use(cors());


//get All Routes
const fenice = require('./routes/fenice');
const dashboardData = require('./routes/DashboardAPIs/sites');
const dashboardLogin = require('./routes/DashboardAPIs/auth');


//health API
app.get("/health", (req, res) => {
  res.sendStatus(200);
})


//use api routes
app.use("/fenice", fenice);
app.use("/dashboard/sites", dashboardData);
app.use("/dashboard/auth", dashboardLogin);


//Check if Live Data and Forecast are available

async function checkLiveAndForecastAvailability() {
  // Make an HTTP request to the external API
  const apiResponse = await axios.get('https://gm33of7aig.execute-api.ap-south-1.amazonaws.com/dev/get-utility-sites');

  // Convert the API response data into a readable stream
  const readableStream = new Readable();
  readableStream.push(apiResponse.data);
  readableStream.push(null); // Signals the end of data

  await checkLiveAvailability(readableStream);
  await checkForecastAvailability(readableStream);


}

async function checkLiveAvailability(readableStream) {

  const sites = []

  // Process the CSV data
  readableStream
    .pipe(csv())
    .on('data', (row) => {
      const timeframes = ['Daily', 'Monthly', 'Subhourly', 'Hourly'];
      // Check if the row has the company name
      for (let i = 0; i < timeframes.length; i++) {
        let filepath = `/home/csv/${row.company}/${timeframes[i].toLowerCase()}/Solarad_${row.sitename}_${row.company}_${timeframes[i]}.csv`;

        if (!fileSystem.existsSync(filepath)) {
          sites.push({
            'company': row.company,
            'site': row.sitename,
            'timeframe': timeframes[i]
          });
        }
      }
    })
    .on('end', () => {
      for (let i = 0; i < sites.length; i++) {
        const message = {
          attachments: [
            {
              color: '#FF0000', // Red color in hexadecimal
              fields: [
                {
                  title: 'Alert From The Node Server',
                  value: `Live Data File Not Found : ${sites[i].company} - ${sites[i].site} - ${sites[i].timeframe}`,
                  short: true,
                },
              ],
            },
          ],
        };
        if (sites.length > 0) {
          axios.post("https://hooks.slack.com/services/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", message)
            .catch(err => {console.log(err); return});
        }
      }
    });
}

async function checkForecastAvailability(readableStream) {

  const sites = [];

  // Process the CSV data
  readableStream
    .pipe(csv())
    .on('data', (row) => {
      //get the current date
      if (row.show_forecast === 'True') {
        let date = new Date();
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        if (month < 10) month = `0${month}`;
        let day = date.getDate();
        if (day < 10) day = `0${day}`;
        // Check if the row has the company name
        let filepath = `/home/Forecast/${row.company}/forecasts/Solarad_${row.sitename}_${row.company}_Forecast_${year}-${month}-${day}_ID.csv`;
        if (!fileSystem.existsSync(filepath)) {
          sites.push({
            'company': row.company,
            'site': row.sitename,
            'date': `${year}-${month}-${day}`
          });
        }
      }
    })
    .on('end', () => {
      for (let i = 0; i < sites.length; i++) {
        const message = {
          attachments: [
            {
              color: '#FF0000', // Red color in hexadecimal
              fields: [
                {
                  title: 'Alert From The Node Server',
                  value: `Forecast Data File Not Found : ${sites[i].company} - ${sites[i].site} - ${sites[i].date}`,
                  short: true,
                },
              ],
            },
          ],
        };
        if (sites.length > 0) {
          axios.post("https://hooks.slack.com/services/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", message)
            .catch(err => {console.log(err); return});
        }
      }
    });
}

// Call the function immediately when the program starts
// checkLiveAndForecastAvailability();

// Set an interval to run the function every hour
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
