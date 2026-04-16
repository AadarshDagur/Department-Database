const crypto = require('crypto');
const pool = require('../config/database');
const { sendMail } = require('../config/email');

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

async function createAndSendOTP(userId, email) {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

  // Invalidate old OTPs
  await pool.query('UPDATE otp_details SET is_used = TRUE WHERE user_id = $1 AND is_used = FALSE', [userId]);

  // Create new OTP
  await pool.query(
    'INSERT INTO otp_details (user_id, otp, expires_at) VALUES ($1, $2, $3)',
    [userId, otp, expiresAt]
  );

  // Send email
  await sendMail({
    to: email,
    subject: 'Your Login OTP - Department Database',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb;">Department Database Login</h2>
        <p>Your OTP code is:</p>
        <div style="font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 6px; text-align: center; padding: 16px; background: #eff6ff; border-radius: 8px; margin: 16px 0;">
          ${otp}
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 2 minutes. Do not share it.</p>
      </div>
    `
  });

  return otp;
}

async function verifyOTP(userId, otpCode) {
  const result = await pool.query(
    `SELECT * FROM otp_details 
     WHERE user_id = $1 AND otp = $2 AND is_used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [userId, otpCode]
  );
  if (result.rows.length === 0) return false;

  // Mark as used
  await pool.query('UPDATE otp_details SET is_used = TRUE WHERE id = $1', [result.rows[0].id]);
  return true;
}

module.exports = { generateOTP, createAndSendOTP, verifyOTP };
