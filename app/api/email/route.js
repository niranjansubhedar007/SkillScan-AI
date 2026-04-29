import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

function buildEmailHtml({ recipientName, subject, body, senderName }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0F172A;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1e293b 0%,#1a1040 100%);border-radius:16px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px;background:linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:10px;padding:8px 12px;">
                      <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:-0.5px;">⚡ SkillScan AI</span>
                    </div>
                    <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:6px 0 0;">Enterprise Resume Intelligence</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${recipientName ? `<p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Dear <strong style="color:#e2e8f0;">${recipientName}</strong>,</p>` : ''}
              <div style="color:#cbd5e1;font-size:15px;line-height:1.8;white-space:pre-line;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:0;" />
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;">
              <p style="color:#64748b;font-size:12px;margin:0;">
                Sent via <strong style="color:#8b5cf6;">SkillScan AI</strong>${senderName ? ` by ${senderName}` : ''} — AI-powered talent intelligence platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req) {
  try {
    const { to, recipientName, subject, body, senderName } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients = Array.isArray(to) ? to : [to];
    for (const email of recipients) {
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: `Invalid email address: ${email}` }, { status: 400 });
      }
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const html = buildEmailHtml({ recipientName, subject, body, senderName });

    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'SkillScan AI'}" <${process.env.SMTP_USER}>`,
      to: recipients.join(', '),
      subject,
      text: body,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Email send error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send email' }, { status: 500 });
  }
}
