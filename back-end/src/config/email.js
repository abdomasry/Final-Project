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

module.exports = { sendVerificationEmail }