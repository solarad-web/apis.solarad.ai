const express = require("express")
const app = express()
const dotenv = require("dotenv")
dotenv.config();
const axios = require('axios')
const csvParser = require('csv-parser')
const fileSystem = require("fs")
const pool = require("./config/db")

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


app.get('/addForecastDataToDB', async (req, res, next) => {
  try {
      const clients = {
          'CleanTech': ['Hatkarwadi'],
          'HeroFutureEnergies': ['Barod', 'Ichhawar'],
          'O2Power': ['Gorai'],
          'Sunsure': ['Banda'],
          'Avaada': ['Pavagada-1', 'Bhadla-2'],
          "BrookfieldRenewable": ["Jodhpur"],
          "HeroFutureEnergies": ["Ichhawar", "Barod", "Bhadla", "Siddipet"],
          'Refex': ['Bhilai'],
          'Sprng': ['Arinsun'],
          'Vibrant': ['Savner']
      }

      for (const [client, value] of Object.entries(clients)) {
          //loop through all the csv files in the ml_forecasts folder

          for (const site of value) {
              let dates = fs.readdir(`/home/ec2-user/efs-solarad-output/csv/clients/${client}/ml_forecasts/Solarad_${site}_${client}`);
              for (const date of dates) {
              let filepath = `/home/ec2-user/efs-solarad-output/csv/clients/${client}/ml_forecasts/Solarad_${site}_${client}_Forecast_${date}_ID.csv`;

              //get modelname from /home/ec2-user/efs_solaradoutput/records_ml/clients/${client}/${site}/${site}_best_model_runs.csv
              const siteIdQuery = await pool.query("SELECT id FROM utility_sites WHERE sitename = $1 AND company = $2", [site, client]);
              const siteId = siteIdQuery.rows[0].id;
              let modelname = null;
              const modelFile = `/home/ec2-user/efs_solaradoutput/records_ml/clients/${client}/${site}/${site}_best_model_runs.csv`;
                  

              //get previous date
              const dateParts = date.split('-');
              const year = dateParts[0];
              const month = dateParts[1];
              const day = dateParts[2];
              const prevDate = moment(`${year}-${month}-${day}`).subtract(1, 'days').format('YYYY-MM-DD');

              const readableStreamForModel = fs.createReadStream(modelFile)

              if(fs.existsSync(modelFile)) {
                  readableStreamForModel
                  .pipe(csv())
                  .on('data', async (row) => {
                      if(row['site_id'] === siteId && row['train_date'] === prevDate) {
                          modelname = row['model'];
                      }
                  })
                  .on('end', () => {
                      console.log(`CSV file successfully processed for ${site} and ${client}`);
                  });
              }


              const readableStream = fs.createReadStream(filepath);

              //if filepath does not exist then skip
              if (!fs.existsSync(filepath)) {
                  console.log("File does not exist");
                  res.send("File does not exist");
                  return;
              }

              readableStream
                  .pipe(csv())
                  .on('data', async (row) => {
                      const time = row['time'];
                      const block = row['block'];
                      const gen_final = parseFloat(row['Gen Final']);
                      const ghi_final = parseFloat(row['GHI Final']);
                      const poa_final = parseFloat(row['POA Final']);
                      const ghi_rev1 = parseFloat(row['Gen Rev0']);
                      const ghi_rev0 = parseFloat(row['GHI Rev0']);
                      const gen_rev0 = parseFloat(row['Gen Rev1']);
                      const gen_rev1 = parseFloat(row['GHI Rev1']);
                      const ghi_rev2 = parseFloat(row['Gen Rev2']);
                      const gen_rev2 = parseFloat(row['GHI Rev2']);
                      const ghi_rev3 = parseFloat(row['Gen Rev3']);
                      const gen_rev3 = parseFloat(row['GHI Rev3']);
                      const ghi_rev4 = parseFloat(row['Gen Rev4']);
                      const gen_rev4 = parseFloat(row['GHI Rev4']);
                      const ghi_rev5 = parseFloat(row['Gen Rev5']);
                      const gen_rev5 = parseFloat(row['GHI Rev5']);
                      const ghi_rev6 = parseFloat(row['Gen Rev6']);
                      const gen_rev6 = parseFloat(row['GHI Rev6']);
                      const ghi_rev7 = parseFloat(row['Gen Rev7']);
                      const gen_rev7 = parseFloat(row['GHI Rev7']);
                      const ghi_rev8 = parseFloat(row['Gen Rev8']);
                      const gen_rev8 = parseFloat(row['GHI Rev8']);
                      const ghi_rev9 = parseFloat(row['Gen Rev9']);
                      const gen_rev9 = parseFloat(row['GHI Rev9']);
                      
                      //
                      await pool.query("INSERT INTO forecast_temp (site_id, block, time, gen_final, ghi_final, poa_final, ghi_rev1, ghi_rev0, gen_rev0, gen_rev1, ghi_rev2, gen_rev2, ghi_rev3, gen_rev3, ghi_rev4, gen_rev4, ghi_rev5, gen_rev5, ghi_rev6, gen_rev6, ghi_rev7, gen_rev7, ghi_rev8, gen_rev8, ghi_rev9, gen_rev9, model_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9 , $10, $11, $12, $13, $14, $15, $16, $17 , $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)", [siteId, block, time, gen_final, ghi_final, poa_final, ghi_rev1, ghi_rev0, gen_rev0, gen_rev1, ghi_rev2, gen_rev2, ghi_rev3, gen_rev3, ghi_rev4, gen_rev4, ghi_rev5, gen_rev5, ghi_rev6, gen_rev6, ghi_rev7, gen_rev7, ghi_rev8, gen_rev8, ghi_rev9, gen_rev9, modelname]);
                  }
                  )
                  .on('end', () => {
                      console.log(`CSV file successfully processed for ${site} and ${client}`);
                  });
              }
          }
      }

      res.send("Done");

  } catch (err) {
      console.log(err.message);
      return;
  }
}
);





































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
