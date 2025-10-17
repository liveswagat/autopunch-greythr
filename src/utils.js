import fs from "fs";

export function isHolidayOrWeekend() {
  const today = new Date();
  const holidays = JSON.parse(fs.readFileSync("src/holidays.json", "utf-8"));
  const dateStr = today.toISOString().split("T")[0];

  const day = today.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return true;
  if (holidays.includes(dateStr)) return true;

  return false;
}

export async function randomDelay(maxMinutes = 5) {
  const delay = Math.floor(Math.random() * maxMinutes * 60 * 1000);
  console.log(`⏳ Waiting ${Math.floor(delay / 60000)} min before starting...`);
  await new Promise((r) => setTimeout(r, delay));
}
