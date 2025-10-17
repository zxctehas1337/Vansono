const nodemailer = require('nodemailer');

// Create SMTP transport with aggressive fail-fast timeouts
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;

const smtpTransport = nodemailer.createTransport({
  // Prefer service when using Gmail to avoid DNS issues on some hosts
  service: smtpHost.includes('gmail.com') ? 'gmail' : undefined,
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  requireTLS: !smtpSecure, // require STARTTLS on 587
  auth: (
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  ),
  // Reduce timeouts so we fall back quickly if SMTP is blocked by hosting
  connectionTimeout: 5000, // 5s to establish TCP/TLS
  greetingTimeout: 5000,   // 5s waiting for greeting
  socketTimeout: 7000      // 7s for overall inactivity
});

function parseFromAddress(rawFrom) {
  if (!rawFrom) return undefined;
  const match = /^(.*)<([^>]+)>$/.exec(String(rawFrom));
  if (match) {
    const name = match[1].trim().replace(/"/g, '');
    const email = match[2].trim();
    return { name: name || undefined, email };
  }
  return { email: String(rawFrom).trim() };
}

async function sendWithSMTP(mailOptions) {
  // Fail fast if no credentials provided
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    const err = new Error('SMTP credentials are not configured');
    err.code = 'ENOCREDS';
    throw err;
  }
  return smtpTransport.sendMail(mailOptions);
}

async function sendWithMailerSend(mailOptions) {
  const apiKey = process.env.TOKEN; // MailerSend API token
  const fromRaw = process.env.MAILERSEND_FROM || process.env.SMTP_FROM || mailOptions.from;
  if (!apiKey || !fromRaw) {
    const err = new Error('MailerSend is not configured');
    err.code = 'ENOMAILERSEND';
    throw err;
  }

  const from = parseFromAddress(fromRaw);
  const toArray = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
  const to = toArray.filter(Boolean).map((e) => ({ email: e }));

  const res = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to,
      subject: mailOptions.subject,
      html: mailOptions.html
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`MailerSend API error: ${res.status} ${text}`);
    err.code = 'EMAIL_API_ERROR';
    throw err;
  }
}

async function sendWithResend(mailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || mailOptions.from;
  if (!apiKey || !from) {
    const err = new Error('Resend is not configured');
    err.code = 'ENORESPROV';
    throw err;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
      subject: mailOptions.subject,
      html: mailOptions.html
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Resend API error: ${res.status} ${text}`);
    err.code = 'ERESEND';
    throw err;
  }
}

async function sendVerificationCode(email, code) {
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Sontha - Verification Code',
    html: `
      <div style="background:#f5f9ff;padding:32px 0;">
        <div style="max-width:420px;margin:0 auto;background:white;border-radius:16px;box-shadow:0 2px 8px #dce6fa;padding:32px 24px 24px 24px;font-family:sans-serif;">
          <div style="text-align:center;">
            <h1 style="color:#2152ff;letter-spacing:-1px;margin-bottom:4px;font-family:sans-serif;">Sontha</h1>
            <div style="text-align:center;margin:16px 0;">
              <span style="display:inline-block;background:#2152ff;color:white;font-size:32px;font-weight:700;letter-spacing:8px;border-radius:8px;padding:14px 28px 12px 28px;">
                ${String(code).padStart(6, '0')}
              </span>
            </div>
            <p style="font-size:17px;color:#234;font-family:sans-serif;">Введите этот код для подтверждения вашей почты в Sontha.</p>
          </div>
          <div style="margin-top:32px;text-align:center;font-size:13px;color:#456;opacity:0.7;">
            Если вы не регистрировались &mdash; просто проигнорируйте это письмо.
          </div>
        </div>
      </div>
    `
  };

  // Prefer MailerSend HTTP API if configured (best for PaaS). Otherwise try Resend if configured, else SMTP.
  const hasMailerSend = Boolean(process.env.TOKEN && (process.env.MAILERSEND_FROM || process.env.SMTP_FROM || mailOptions.from));
  if (hasMailerSend) {
    try {
      await sendWithMailerSend(mailOptions);
      return true;
    } catch (err) {
      // If MailerSend fails transiently, fall back to SMTP
      const transient = ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'];
      if (transient.includes(err.code)) {
        await sendWithSMTP(mailOptions);
        return true;
      }
      throw err;
    }
  }

  // Optional: Resend fallback only if explicitly configured
  const hasResend = Boolean(process.env.RESEND_API_KEY && (process.env.RESEND_FROM || process.env.SMTP_FROM));
  if (hasResend) {
    await sendWithResend(mailOptions);
    return true;
  }

  // No Resend configured → use SMTP and fail fast on connection issues
  try {
    await sendWithSMTP(mailOptions);
    return true;
  } catch (err) {
    const transient = ['ETIMEDOUT', 'ECONNECTION', 'ENOTFOUND', 'EAI_AGAIN'];
    if (transient.includes(err.code) || err.code === 'ENOCREDS') {
      // If SMTP is unavailable and no HTTP provider configured, surface a clear error
      const fallbackErr = new Error('Email provider not reachable. Configure TOKEN (MailerSend) or fix SMTP.');
      fallbackErr.cause = err;
      throw fallbackErr;
    }
    throw err;
  }
}

module.exports = { sendVerificationCode };