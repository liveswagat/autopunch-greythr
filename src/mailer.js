import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { sendTelegramMessage } from "./telegram.js"; // 👈 NEW

dotenv.config();

export async function sendMail(
  subject,
  message,
  isSuccess = true,
  location = null
) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // for port 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const now = new Date().toLocaleString("en-IN", {
    timeZone: process.env.TIMEZONE || "Asia/Kolkata",
  });

  const htmlContent = `
  <div style="font-family: Arial, sans-serif; background-color: #f6f7fb; padding: 20px;">
    <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div style="background: ${
        isSuccess ? "#4caf50" : "#e53935"
      }; color: white; text-align: center; padding: 15px 0;">
        <h2 style="margin: 0;">${subject}</h2>
      </div>

      <div style="padding: 20px;">
        <p style="font-size: 15px; color: #333;">
          ${
            isSuccess
              ? "✅ Your scheduled automation ran successfully."
              : "⚠️ Your automation encountered an error."
          }
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px; font-weight: bold;">📅 Time:</td>
            <td style="padding: 8px;">${now}</td>
          </tr>
          ${
            location
              ? `<tr>
                  <td style="padding: 8px; font-weight: bold;">📍 Location:</td>
                  <td style="padding: 8px;">Lat: ${location.latitude}, Lng: ${location.longitude}</td>
                 </tr>`
              : ""
          }
          <tr>
            <td style="padding: 8px; font-weight: bold;">📝 Message:</td>
            <td style="padding: 8px;">${message}</td>
          </tr>
        </table>

        <div style="margin-top: 20px; font-size: 13px; color: #666;">
          <p>This email was automatically sent by your GreytHR auto-punch bot.</p>
          <p>If this was not expected, you can disable the GitHub Action in your repository settings.</p>
        </div>
      </div>

      <div style="background: #f0f0f0; text-align: center; padding: 10px; font-size: 12px; color: #777;">
        © ${new Date().getFullYear()} Auto Punch Scheduler | Made with ❤️ by Automation
      </div>
    </div>
  </div>
  `;

  const mailOptions = {
    from: `"Auto Punch Bot" <${process.env.SMTP_USER}>`,
    to: process.env.EMAIL_TO,
    subject,
    text: message,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📩 Email notification sent.");

    // 👇 Also send Telegram message
    const telegramMsg = `
${isSuccess ? "✅ <b>Success</b>" : "⚠️ <b>Error</b>"}  
<b>${subject}</b>

🕒 <b>Time:</b> ${now}
${
  location
    ? `📍 <b>Location:</b> ${location.latitude}, ${location.longitude}`
    : ""
}
📝 <b>Message:</b> ${message}
    `.trim();

    await sendTelegramMessage(telegramMsg);
  } catch (error) {
    console.error("❌ Failed to send email:", error.message);

    // ⚠️ Even if email fails, still notify on Telegram
    await sendTelegramMessage(`⚠️ <b>Email failed</b>\n${error.message}`);
  }
}
