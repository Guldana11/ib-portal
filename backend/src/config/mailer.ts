import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465',
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.log(`[MAIL SKIP] No SMTP configured. To: ${to}, Subject: ${subject}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@crystalspring.kz',
    to,
    subject,
    text,
    html: html || text,
  });
}

export default transporter;
