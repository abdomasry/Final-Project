const nodemailer = require("nodemailer")

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
})

const sendVerificationEmail = async (toEmail, code) => {
  await transporter.sendMail({
    from: `"خدمات الحرفيين" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "كود تفعيل الحساب",
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px;">
        <h2>مرحباً بك في خدمات الحرفيين</h2>
        <p>كود تفعيل حسابك هو:</p>
        <div style="
          font-size: 36px;
          font-weight: bold;
          letter-spacing: 8px;
          color: #148F77;
          background: #f0fdf4;
          padding: 20px 40px;
          border-radius: 12px;
          display: inline-block;
          margin: 20px 0;
        ">
          ${code}
        </div>
        <p>استخدم الكود لتأكيد حسابك: <a href="${process.env.BASE_URL}/verify-email" style="color: #148F77; text-decoration: underline;">تأكيد الحساب</a></p>
        <p style="color: #666;">هذا الكود صالح لمدة 10 دقائق فقط</p>
      </div>
    `,
  })
}

// =============================================================================
// sendPasswordResetEmail — emails a one-hour reset link to the user
// =============================================================================
// The link points at the frontend's /reset-password page with the JWT token
// in the query string. The frontend POSTs that token + the new password to
// /api/auth/reset-password (see auth.controller.resetPassword).
//
// Why a link instead of a 6-digit code (like verify-email):
//   Reset is rare and the user is on a desktop after misplacing their password —
//   a one-click link is faster than typing a code, and there's no typo risk.
const sendPasswordResetEmail = async (toEmail, resetToken) => {
  // BASE_URL is the frontend origin (set in back-end/.env). Falls back to the
  // local dev URL so we never email a broken link in development.
  const baseUrl = process.env.BASE_URL || "http://localhost:3000"
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`

  await transporter.sendMail({
    from: `"خدمات الحرفيين" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "إعادة تعيين كلمة المرور",
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px; direction: rtl;">
        <h2 style="color: #121c2a;">طلب إعادة تعيين كلمة المرور</h2>
        <p style="color: #3e4947; line-height: 1.6;">
          استلمنا طلباً لإعادة تعيين كلمة المرور لحسابك.<br/>
          إذا كنت أنت من قام بهذا الطلب، اضغط على الرابط أدناه لإنشاء كلمة مرور جديدة.
        </p>
        <a href="${resetLink}" style="
          display: inline-block;
          background: #005c55;
          color: #ffffff;
          padding: 14px 32px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: bold;
          margin: 24px 0;
          font-size: 16px;
        ">
          إعادة تعيين كلمة المرور
        </a>
        <p style="color: #666; font-size: 13px;">
          هذا الرابط صالح لمدة ساعة واحدة فقط.<br/>
          إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان.
        </p>
        <p style="color: #888; font-size: 12px; margin-top: 32px; word-break: break-all;">
          إن لم يعمل الزر أعلاه، انسخ الرابط التالي:<br/>
          <span style="color: #005c55;">${resetLink}</span>
        </p>
      </div>
    `,
  })
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail }