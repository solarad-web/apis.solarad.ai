const Router = require("express");
const route = Router();

const dotenv = require("dotenv");
dotenv.config();

const bcrypt = require("bcrypt");
const pool = require('../../config/db');
const jwt = require('jsonwebtoken');
const { sendMagicLinkEmail, sendResetPasswordLink } = require("../../services/mailer");


//done
//done
route.get("/signUp", async (req, res, next) => {
    const email = req.query.email;
    const fname = req.query.fname;
    const lname = req.query.lname;
    const pwd = req.query.pwd;
    const company = req.query.company;

    try {
        await pool.query(`INSERT INTO leads (user_email, user_fname, user_lname, company) VALUES 
        ($1, $2, $3, $4)`, [email, fname, lname, company]);

        const data = await pool.query(`SELECT * FROM user_details WHERE user_email = $1`, [email]);

        if (data.rowCount != 0) {
            res.send("Email Present");
            return;
        }
        const token = jwt.sign({ email: email, fname: fname, lname: lname, pwd: pwd, company: "Demo" }, process.env.JWT_SECRET, {
            expiresIn: "24h",
        })
        await sendMagicLinkEmail({ email: email, token: token, fname: fname });
        res.status(200).send('Email Sent');
    } catch (error) {
        console.log(error.message);
        next(error);
    }
});


//done
//done
route.get("/signIn", async (req, res, next) => {
    const email = req.query.email;
    const providedPwd = req.query.pwd;

    //get passhash from postgres
    const data = await pool.query(`SELECT * FROM user_details WHERE user_email = $1`, [email]);

    if (data.rowCount === 0) {
        res.send("Email Not Present");
        return;
    }
    const company = data.rows[0].company;
    const storedPassHash = data.rows[0].passhash;

    try {
        bcrypt.compare(providedPwd, storedPassHash, (err, result) => {
            if (result) {
                if(company === process.env.ADMIN_COMPANY){
                    res.status(200).send('Admin');
                    return;
                }
                else if(company === process.env.SUPERADMIN_COMPANY){
                    res.status(200).send('Super_Admin');
                    return;
                }
                else res.status(200).send('Valid');
            }
            else res.status(401).send('Invalid');
        });

    } catch (err) {
        console.log(err);
        next(err);
    }
})


//done
//done
route.get("/verifyEmail", async (req, res, next) => {
    const token = req.query.token;
    if (token == null) return res.sendStatus(401);

    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const email = decodedToken.email;
        const fname = decodedToken.fname;
        const lname = decodedToken.lname;
        const pwd = decodedToken.pwd;
        const passhash = await generateHash(pwd);
        const company = decodedToken.company;

        await pool.query(`INSERT INTO user_details (user_email, user_fname, user_lname, company, passhash)
      VALUES ($1, $2, $3, $4, $5)`, [email, fname, lname, company, passhash]);

        res.redirect(`https://app.solarad.ai/emaillogin?email=${email}&password=${pwd}`)

    } catch (error) {
        console.log(error);
        next(error);
    }
});

//done
//done
route.get('/forgotPassword', async (req, res, next) => {
    try {
        const email = req.query.email;

        const data = await pool.query(`SELECT * FROM user_details WHERE user_email = $1`, [email]);

        if (data.rowCount === 0) {
            res.send("Email Not Present");
            return;
        }

        const token = jwt.sign({ email: email }, process.env.JWT_SECRET, {
            expiresIn: "1h",
        })

        await sendResetPasswordLink({ email: email, fname: data.rows[0].user_fname, token: token });
        res.send("Email Sent");
    } catch (error) {
        console.log(error);
        next(error);
    }
})


//done
//done
route.get('/resetPassword', async (req, res, next) => {
    try {
        const token = req.query.token;
        if (token == null) return res.sendStatus(401);
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const email = decodedToken.email;
        const password = req.query.pwd;
        const passhash = await generateHash(password);

        await pool.query(`UPDATE user_details SET passhash = $1 WHERE user_email = $2`, [passhash, email]);
        res.status(200).send("Password Updated!");
    } catch (err) {
        console.log(err)
        next(err);
    }
})






//generate hash value for password
async function generateHash(password) {
    try {
        const salt = await bcrypt.genSalt(11);
        const hash = await bcrypt.hash(password, salt);
        return hash;
    } catch (error) {
        console.log(error.message);
        throw new Error('Hash generation failed');
    }
}



module.exports = route;

