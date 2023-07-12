const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const fileSystem = require('fs');
const bcrypt = require('bcrypt');

app.get('/health', (req, res) => {
    res.sendStatus(200);
});

app.get('/getfilefroms3', async (req, res) => {
    let providedApiKey = req.query.api_key;
    const storedApiKey = process.env.API_KEY;

    bcrypt.compare(providedApiKey, storedApiKey, (err, result) => {
        if (result) {
            let site_id = req.query.site_id;
            var filePath = `/home/ec2-user/s3-solaradoutput/Fenice/site_${site_id}.csv`;
            var stat = fileSystem.statSync(filePath);

            res.set('Content-Disposition', `attachment; filename=site_${site_id}.csv`);
            res.set('Content-Type', 'text/csv');
            res.set('Content-Length', stat.size);

            var readStream = fileSystem.createReadStream(filePath);
            readStream.pipe(res);
        } else {
            res.status(401).send("Unauthorized");
        }
    });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || `localhost`;

app.listen(PORT, () => {
    console.log(`Server is running at http://${HOST}:${PORT}`);
});
