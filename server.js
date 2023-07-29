const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();


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
