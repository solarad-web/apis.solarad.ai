const express = require("express")
const app = express()
const dotenv = require("dotenv")
dotenv.config();
const axios = require('axios')
const csvParser = require('csv-parser')
const fileSystem = require("fs")
const pool = require("./config/db")
const cron = require('node-cron')
const { parseAsync } = require('json2csv');
const { sendRevMail } = require("./services/mailer");

//Enable cors
const cors = require("cors")
app.use(cors())


//get All Routes
const fenice = require('./routes/fenice')
const dashboardData = require('./routes/DashboardAPIs/sites')
const dashboardLogin = require('./routes/DashboardAPIs/auth')
const dashboardAdmin = require('./routes/DashboardAPIs/admin')

//health API
app.get("/health", (req, res) => {
  res.sendStatus(200)
})

app.get('/dbtest', (req, res) => {
  pool.query('SELECT NOW()', (err, result) => {
    if (err) {
      console.log(err)
      res.status(500).send('Something went wrong')
    }
    else {
      res.send(result.rows)
    }
  })
})

//use api routes
app.use("/fenice", fenice)
app.use("/dashboard/sites", dashboardData)
app.use("/dashboard/auth", dashboardLogin)
app.use("/dashboard/admin", dashboardAdmin)


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
    }
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
      let filepath = `/home/Forecast/${allSites[i].company}/ml_forecasts/Solarad_${allSites[i].sitename}_${allSites[i].company}_Forecast_${year}-${month}-${day}_ID.csv`;
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

    }
    if (missingSites.length > 0) {
      axios.post(process.env.SLACK_WEBHOOK, message)
        .catch(err => { console.log(err); return });
    }
  }
}




//Rev Mailer Service
async function sendRevMailFunc(revNo, revTime) {
  console.log("sendRevMailFunc")
  const query = await pool.query(`SELECT sitename, company, capacity, mailer_emails FROM utility_sites WHERE rev_mailer = true`)
  const sites = query.rows

  sites.forEach(async (row) => {
    console.log(row)
    const sitename = row.sitename
    const mailer_emails = row.mailer_emails
    const company = row.company
    const capacity = row.capacity

    //get current date in YYYY-MM-DD format
    const date = new Date()
    const year = date.getFullYear()
    let month = date.getMonth() + 1
    if (month < 10) month = `0${month}`
    let day = date.getDate()
    if (day < 10) day = `0${day}`
    const today = `${year}-${month}-${day}`

  const metadata = [
    {'Block': 'Name of Forecaster', 'Time': 'Solarad.ai'},
    { 'Block': 'Schedule for dated', 'Time': today },
    { 'Block': 'Revision No.', 'Time': revNo },
    { 'Block': 'Time of Revision Hrs', 'Time': revTime },
    { 'Block': '', 'Time': '', 'Day Ahead Schedule (MW)': '', 'Current Available Capacity (MW)': '', 'Revised Schedule (MW)': '' },
    { 'Block': 'Block', 'Time': 'Time', 'Day Ahead Schedule (MW)': 'Day Ahead Schedule (MW)', 'Current Available Capacity (MW)': 'Current Available Capacity (MW)', 'Revised Schedule (MW)': 'Revised Schedule (MW)' },
  ];

  const revCsvFilePath = `/home/Forecast/${company}/ml_forecasts/Solarad_${sitename}_${company}_Forecast_${today}_ID.csv`
  if (!fileSystem.existsSync(revCsvFilePath)) {
    console.log(revCsvFilePath + " not found")
    return
  }

  const rows = [];
  let totalDayAhead = 0;
  let totalRevised = 0;
  let totalCurrent = 0;
  let maxDayAhead = 0;
  let maxRevised = 0;
  let maxCurrent = 0;
  let minDayAhead = 100000000000;
  let minRevised = 100000000000;
  let minCurrent = 100000000000;
  let avgDayAhead = 0;
  let avgRevised = 0;
  let avgCurrent = 0;
  let count = 0;
  fileSystem.createReadStream(revCsvFilePath)
    .pipe(csvParser())
    .on('data', async (row) => {
      rows.push(row);
    })
    .on('end', async () => {
      const transformedData = rows.map((row, index) => {
        totalDayAhead += parseFloat(row['Gen Rev0']);
        totalRevised += parseFloat(row['Gen Final']);
        totalCurrent += parseFloat(capacity);
        maxDayAhead = Math.max(maxDayAhead, parseFloat(row['Gen Rev0']));
        maxRevised = Math.max(maxRevised, parseFloat(row['Gen Final']));
        maxCurrent = Math.max(maxCurrent, parseFloat(capacity));
        minDayAhead = Math.min(minDayAhead, parseFloat(row['Gen Rev0']));
        minRevised = Math.min(minRevised, parseFloat(row['Gen Final']));
        minCurrent = Math.min(minCurrent, parseFloat(capacity));
        count++;
  
        const dayAhead = parseFloat(row['Gen Rev0']);
        const currRev = parseFloat(row['Gen Final']);
        const time = new Date(row['Time'].split('+')[0]);
        const sunIsOut = time.getHours() >= 5 && (time.getHours() < 19 || (time.getHours() === 19 && time.getMinutes() <= 15));
        return {
          'Block': row['Block'],
          'Time': row['Time'],
          'Day Ahead Schedule (MW)': dayAhead.toFixed(2),
          'Current Available Capacity (MW)': sunIsOut ? capacity : 0,
          'Revised Schedule (MW)': currRev.toFixed(2),
        };
      });
  
      avgCurrent = totalCurrent / count;
      avgDayAhead = totalDayAhead / count;
      avgRevised = totalRevised / count;
  
      const metadata2 = [
        { 'Block': 'Total Generation(MWHr)', 'Time': '(24 Hrs)', 'Day Ahead Schedule (MW)': totalDayAhead.toFixed(2), 'Current Available Capacity (MW)': totalCurrent.toFixed(2), 'Revised Schedule (MW)': totalRevised.toFixed(2) },
        { 'Block': 'Max Generation(MW)', 'Time': '(24 Hrs)', 'Day Ahead Schedule (MW)': maxDayAhead.toFixed(2), 'Current Available Capacity (MW)': maxCurrent.toFixed(2), 'Revised Schedule (MW)': maxRevised.toFixed(2) },
        { 'Block': 'Min Generation(MW)', 'Time': '(24 Hrs)', 'Day Ahead Schedule (MW)': minDayAhead.toFixed(2), 'Current Available Capacity (MW)': minCurrent.toFixed(2), 'Revised Schedule (MW)': minRevised.toFixed(2) },
        { 'Block': 'Avg Generation(MW)', 'Time': '(24 Hrs)', 'Day Ahead Schedule (MW)': avgDayAhead.toFixed(2), 'Current Available Capacity (MW)': avgCurrent.toFixed(2), 'Revised Schedule (MW)': avgRevised.toFixed(2) },
      ];
  
      const finalData = metadata.concat(transformedData);
  
      const finalData2 = finalData.concat(metadata2);
  
      const fields = [
        'Block',
        'Time',
        'Day Ahead Schedule (MW)',
        'Current Available Capacity (MW)',
        'Revised Schedule (MW)'
      ];
  
      const csv = await parseAsync(finalData2, { fields, header: false });
  
       mailer_emails.forEach(async (email) => {
         await sendRevMail({ email: email, csv: csv, sitename: sitename, company: company, revNo: revNo, revTime: revTime, today: today });
        console.log(`rev mail sent to ${email} for ${sitename} at ${revTime} of revNo ${revNo}`)
      });
    });
    
  });
}


cron.schedule('0 9 * * *', () => {
  sendRevMailFunc(0, '09:00');
});

cron.schedule('0 4 * * *', () => {
  sendRevMailFunc(1, '04:00');
});

cron.schedule('0 5 * * *', () => {
  sendRevMailFunc(2, '05:00');
});

cron.schedule('30 6 * * *', () => {
  sendRevMailFunc(3, '06:30');
});

cron.schedule('0 8 * * *', () => {
  sendRevMailFunc(4, '08:00');
});

cron.schedule('30 9 * * *', () => {
  sendRevMailFunc(5, '09:30');
});

cron.schedule('0 11 * * *', () => {
  sendRevMailFunc(6, '11:00');
});

cron.schedule('30 12 * * *', () => {
  sendRevMailFunc(7, '12:30');
});

cron.schedule('0 14 * * *', () => {
  sendRevMailFunc(8, '14:00');
});

cron.schedule('30 15 * * *', () => {
  sendRevMailFunc(9, '15:30');
});














































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


const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || `localhost`;

app.listen(PORT, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
