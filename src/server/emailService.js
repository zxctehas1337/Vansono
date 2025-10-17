const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

async function sendVerificationCode(email, code) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Sontha - Verification Code',
    html: `
      <h1>Your Verification Code</h1>
      <p>Use this code to verify your account: <strong>${code}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationCode };