const fetch = require('node-fetch');

const RESEND_API_KEY = process.env.TOKEN;
const RESEND_FROM = process.env.RESEND_FROM || 'Sontha <onboarding@resend.dev>';

async function sendEmail(mailOptions) {
  if (!RESEND_API_KEY || !RESEND_FROM) {
    throw new Error('Resend API key or sender address not configured. Please set TOKEN and RESEND_FROM in config.env');
  }

  const payload = {
    from: RESEND_FROM,
    to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
    subject: mailOptions.subject,
    html: mailOptions.html
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend API error: ${res.status} ${text}`);
  }

  return true;
}

async function sendVerificationCode(email, code) {
  const html = `
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
  `;

  return sendEmail({
    to: email,
    subject: 'Sontha - Verification Code',
    html
  });
}

module.exports = { sendVerificationCode, sendEmail };
