const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const axios = require('axios')
const csv = require('csv-parser');
const fileSystem = require("fs");

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
  // Make an HTTP request to the external API
  let filepath = `/home/utility-sites`;

  // Convert the API response data into a readable stream
  const readableStream = fileSystem.createReadStream(filepath)

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
    .on('end', async () => {
      for (let i = 0; i < sites.length; i++) {
        const message = {
          channel: 'C05MA66MUJU',
          attachments: [
            {
              color: '#FF0000', // Red color in hexadecimal
          text: `Alert From The Node Server: Live Data File Not Found : ${sites[i].company} - ${sites[i].site} - ${sites[i].timeframe}`,

            },
          ],
        };
        if (sites.length > 0) {
          axios.post(process.env.SLACK_WEBHOOK, message)
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
    .on('end', async () => {
      for (let i = 0; i < sites.length; i++) {
        const message = {
          channel: 'C05MA66MUJU',
          attachments: [{
            color: '#FF0000', // Red color in hexadecimal
          text: `Alert From The Node Server: Forecast Data File Not Found : ${sites[i].company} - ${sites[i].site} - ${sites[i].date}`,
          }],

        };
        if (sites.length > 0) {
          axios.post(process.env.SLACK_WEBHOOK, message)
            .catch(err => {console.log(err); return});
        }
      }
    });
}


// Call the function immediately when the program starts
checkLiveAndForecastAvailability();

// Set an interval to run the function every hour
setInterval(checkLiveAndForecastAvailability, 3600000);



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
