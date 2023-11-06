const express = require("express")
const app = express()
const dotenv = require("dotenv")
dotenv.config();
const pool = require("./config/db")

//Enable cors
const cors = require("cors")
app.use(cors())


//get All Routes
const fenice = require('./routes/fenice')
const dashboardData = require('./routes/DashboardAPIs/sites')
const dashboardLogin = require('./routes/DashboardAPIs/auth')
const dashboardAdmin = require('./routes/DashboardAPIs/admin')


app.get("/health", (req, res) => {
  res.sendStatus(200)
})

app.get('/dbtest', async (req, res) => {
  try {
    pool.query('SELECT NOW()', (err, result) => {
      if (err) {
        console.log(err)
        res.status(500).send('Something went wrong')
      }
      else {
        res.send(result.rows)
      }
    })
  }
  catch (err) {
    console.log(err)
  }
  finally {
    try {
      await pool.end();
      console.log('Pool has ended');
    } catch (endErr) {
      console.error('Error while ending the pool', endErr);
    }
  }
})

//use api routes
app.use("/fenice", fenice)
app.use("/dashboard/sites", dashboardData)
app.use("/dashboard/auth", dashboardLogin)
app.use("/dashboard/admin", dashboardAdmin)



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
  console.log(`Server is running at http://${HOST}:${PORT}`)
})
