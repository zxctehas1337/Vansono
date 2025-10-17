const nodemailer = require('nodemailer');

// Create transport using SMTP env vars
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendVerificationCode(email, code) {
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
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