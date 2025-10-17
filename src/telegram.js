import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Function to send a Telegram message
export async function sendTelegramMessage(message) {
  try {
    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, {
      parse_mode: "HTML",
    });
    console.log("📨 Telegram message sent successfully.");
  } catch (error) {
    console.error("❌ Failed to send Telegram message:", error.message);
  }
}
