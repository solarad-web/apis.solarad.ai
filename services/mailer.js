const { magicLinkHTMLContent, magicLinkByAdminHTMLContent, sendResetPasswordHTMLContent } = require("./htmlContent")
import nodemailer from 'nodemailer'


const transporter = nodemailer.createTransport({
    host: process.env.BREVO_HOST,
    port: process.env.BREVO_PORT,
    secure: false,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_PWD,
    },
  })



async function sendMagicLinkEmail({ email, token, fname }) {

      const html = magicLinkHTMLContent(token, fname);

      let info = await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: email,
        subject: "Finish Logging In",
        html: html
      });
    
      console.log(info)
}



async function sendMagicLinkEmailByAdmin({ email, password, fname }) {

    const html = magicLinkByAdminHTMLContent(email, password, fname)

    let info = await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: email,
        subject: "Account Created",
        html: html
      })
    
      console.log(info)
}


async function sendResetPasswordLink({ email, fname, token }) {

    const html = sendResetPasswordHTMLContent(email, fname, token)

    let info = await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: email,
        subject: "Reset Your Password",
        html: html
      })
    
    console.log(info)
}


module.exports = {
    sendResetPasswordLink,
    sendMagicLinkEmail,
    sendMagicLinkEmailByAdmin
}