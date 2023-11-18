const express = require("express")
const app = express()
const dotenv = require("dotenv")
dotenv.config();
const pool = require("./config/db")

//Enable cors
const cors = require("cors")
app.use(cors())


//get All Routes
const { feniceRoute } = require('./routes/fenice')
const { sitesRoute } = require('./routes/DashboardAPIs/sites')
const { authRoute } = require('./routes/DashboardAPIs/auth')
const { adminRoute } = require('./routes/DashboardAPIs/admin')


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
app.use("/fenice", feniceRoute)
app.use("/dashboard/sites", sitesRoute)
app.use("/dashboard/auth", authRoute)
app.use("/dashboard/admin", adminRoute)



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
  console.log(`Server running on http://${HOST}:${PORT}`)
})
