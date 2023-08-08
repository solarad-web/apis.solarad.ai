const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const axios = require('axios')
const { Readable } = require('stream');
const csv = require('csv-parser');
const fileSystem = require("fs");
const { WebClient, LogLevel } = require("@slack/web-api");

//Enable cors
const cors = require("cors");
app.use(cors());

const client = new WebClient("xoxb-5219788280755-5724762300976-NuYgEy15vPac7UtPqZDLbPQU", {
  // LogLevel can be imported and used to make debugging simpler
  // logLevel: LogLevel.DEBUG
});

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
          axios.post("https://hooks.slack.com/services/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", message)
            .catch(err => {console.log(err); return});
          // await publishMessage(message);

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
          axios.post("https://hooks.slack.com/services/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", message)
            .catch(err => {console.log(err); return});
          // await publishMessage(message);
        }
      }
    });
}



// Post a message to a channel your app is in using ID and message text
async function publishMessage(message) {
  try {
    // Call the chat.postMessage method using the built-in WebClient
    const result = await client.chat.postMessage(message);

    // Print result, which includes information about the message (like TS)
    console.log(result);
  }
  catch (error) {
    console.error(error);
  }
}



// Call the function immediately when the program starts
checkLiveAndForecastAvailability();

// Set an interval to run the function every hour
setInterval(checkLiveAndForecastAvailability, 3600000);


// async function findConversation(name) {
//   try {
//     // Call the conversations.list method using the built-in WebClient
//     const result = await client.conversations.list({
//       // The token you used to initialize your app
//       token: "xoxb-5219788280755-5724762300976-NuYgEy15vPac7UtPqZDLbPQU"
//     });

//     for (const channel of result.channels) {
//       console.log(channel.name);
//       if (channel.name === name) {
//         console.log(channel.id);
//         // conversationId = channel.id;

//         // // Print result
//         // console.log("Found conversation ID: " + conversationId);
//         // // Break from for loop
//         break;
//       }
//     }
//   }
//   catch (error) {
//     console.error(error);
//   }
// }

// // Find conversation with a specified channel `name`
// findConversation("alerts");


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
