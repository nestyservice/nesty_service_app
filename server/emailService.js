import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Ensure dotenv is initialized
dotenv.config();

/**
 * Universal Campus Email Dispatcher for NESTY
 * Supports:
 *  1. Brevo (Sendinblue) Transactional REST API (via BREVO_API_KEY / SENDINBLUE_API_KEY)
 *  2. Brevo SMTP relay (smtp-relay.brevo.com:587)
 *  3. Custom campus SMTP via Nodemailer
 * 
 * Never logs secrets, passwords, or OTPs.
 * Honestly reports delivery failures instead of pretending success.
 */
export async function sendCampusEmail({ to, name = 'Student', subject, text, html }) {
  // Ensure fresh resolution of environment variables on every call
  const brevoApiKey = (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '').trim();
  const senderEmail = (
    process.env.CAMPUS_EMAIL_SENDER ||
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_FROM ||
    'canteen@cvr.ac.in'
  ).trim();
  const senderName = (
    process.env.CAMPUS_EMAIL_SENDER_NAME ||
    process.env.BREVO_SENDER_NAME ||
    'NESTY Campus Canteen'
  ).trim();

  const recipientEmail = (to || '').trim().toLowerCase();
  if (!recipientEmail || !recipientEmail.includes('@') || !recipientEmail.includes('.')) {
    throw new Error('Invalid recipient email address format.');
  }

  // 1. Try Brevo Transactional Email REST API
  if (brevoApiKey && !brevoApiKey.includes('placeholder') && !brevoApiKey.includes('replace_')) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: recipientEmail, name: name || 'Student' }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok || response.status === 201) {
        // Safe logging without leaking secrets or full emails
        const masked = recipientEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');
        console.log(`[EMAIL_SERVICE] Dispatched via Brevo REST API to: ${masked} (MessageId: ${data.messageId || 'ok'})`);
        return { success: true, messageId: data.messageId, provider: 'brevo_api' };
      }

      console.error(`[EMAIL_SERVICE] Brevo API error (${response.status}): ${data.message || data.code || 'HTTP error'}`);
      throw new Error(`Brevo API returned HTTP ${response.status}: ${data.message || 'Delivery rejected'}`);
    } catch (err) {
      console.error(`[EMAIL_SERVICE] Brevo API request exception: ${err.message}`);
      // Fall through to SMTP if SMTP is configured, otherwise rethrow
      const hasSmtp = Boolean(
        process.env.BREVO_SMTP_KEY ||
        (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
      );
      if (!hasSmtp) {
        throw err;
      }
    }
  }

  // 2. Try SMTP Transport (Brevo relay or custom campus SMTP)
  const smtpHost = process.env.BREVO_SMTP_KEY ? 'smtp-relay.brevo.com' : process.env.SMTP_HOST;
  const smtpUser = process.env.BREVO_SMTP_USER || process.env.BREVO_SMTP_KEY ? (process.env.BREVO_SMTP_USER || senderEmail) : process.env.SMTP_USER;
  const smtpPass = process.env.BREVO_SMTP_KEY || process.env.SMTP_PASS;
  const smtpPort = Number(process.env.SMTP_PORT || (process.env.BREVO_SMTP_KEY ? 587 : 587));

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465 || process.env.SMTP_SECURE === 'true',
        auth: { user: smtpUser, pass: smtpPass },
      });

      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: recipientEmail,
        subject,
        text,
        html,
      });

      const masked = recipientEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      console.log(`[EMAIL_SERVICE] Dispatched via SMTP to: ${masked} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId, provider: 'smtp' };
    } catch (err) {
      console.error(`[EMAIL_SERVICE] SMTP dispatch exception: ${err.message}`);
      throw new Error(`SMTP email delivery failed: ${err.message}`);
    }
  }

  // 3. Automated test environment hook
  if (process.env.NODE_ENV === 'test' && !brevoApiKey) {
    console.log(`[EMAIL_SERVICE] [TEST_MODE] Email dispatch simulated for test suite.`);
    return { success: true, provider: 'test-mock', messageId: 'test_msg_id' };
  }

  // 4. Provider missing in live environment
  console.warn('[EMAIL_SERVICE] No active email provider configured (Missing BREVO_API_KEY or SMTP credentials).');
  throw new Error('Email provider is unconfigured. Please configure BREVO_API_KEY in environment variables.');
}

/**
 * Builds standard campus OTP email template
 */
export function buildVerificationOtpEmail(code, purpose = 'Email Verification') {
  const subject = `Your NESTY Canteen ${purpose}: ${code}`;
  const text = `Hello,\n\nYour NESTY verification code is: ${code}\nThis code is valid for 10 minutes.\nNever share this code with anyone.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1.5px solid #F0E6D8; border-radius: 16px; background-color: #FFFFFF;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #6B1D2F; margin: 0; font-size: 22px; font-weight: 800;">NESTY Campus Canteen</h2>
        <p style="color: #7D6B6F; font-size: 13px; margin: 4px 0 0 0;">CVR College of Engineering</p>
      </div>
      <p style="font-size: 14px; color: #334155; line-height: 1.5;">Use the one-time verification code below for <strong>${purpose}</strong>:</p>
      <div style="background-color: #FFF9F0; border: 2px dashed #E5A93C; padding: 18px; text-align: center; border-radius: 12px; margin: 20px 0;">
        <span style="font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #6B1D2F; font-family: monospace;">${code}</span>
      </div>
      <p style="font-size: 12px; color: #64748B; line-height: 1.4;">
        This code is valid for <strong>10 minutes</strong>. If you did not make this request, please ignore this email.
      </p>
      <div style="border-top: 1px solid #F1E5D8; margin-top: 20px; padding-top: 12px; text-align: center; font-size: 11px; color: #94A3B8;">
        NESTY Smart Campus Food Ordering System
      </div>
    </div>
  `;
  return { subject, text, html };
}
