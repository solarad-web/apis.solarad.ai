const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const fileSystem = require('fs');

app.get('/health', (req, res) => {
    res.send(req.query.filename);
});

app.get('/getfilefroms3', async (req, res) => {
    let api_key = req.query.api_key;
    if (api_key === process.env.API_KEY) {
        let site_id = req.query.site_id;
        var filePath = `/home/ec2-user/s3-solaradoutput/Fenice/site_${site_id}.csv`;
        var stat = fileSystem.statSync(filePath);

        res.writeHead(200, {
            'Content-Type': 'text/csv',
            'Content-Length': stat.size
        });

        var readStream = fileSystem.createReadStream(filePath);
        readStream.pipe(res);
    }
    else {
        res.send("User Unauthorized");
    }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || `localhost`;

app.listen(3000, () => {
    console.log(`Server is running at http://${HOST}:${PORT}`);
})
