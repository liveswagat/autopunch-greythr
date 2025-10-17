import puppeteer from "puppeteer";
import dotenv from "dotenv";
import fs from "fs";
import { isHolidayOrWeekend, randomDelay } from "./utils.js";
import { sendMail } from "./mailer.js";

dotenv.config();

const GREYTHR_URL = process.env.GREYTHR_URL;
const EMP_ID = process.env.EMP_ID;
const PASSWORD = process.env.EMP_PASS;

if (isHolidayOrWeekend()) {
  console.log("🎉 Holiday or weekend — skipping punch out.");
  process.exit(0);
}

// random delay (0–5 min)
await randomDelay(5);

const locations = JSON.parse(fs.readFileSync("locations.json", "utf-8"));
const randomLocation = locations[Math.floor(Math.random() * locations.length)];

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const context = browser.defaultBrowserContext();
    await context.overridePermissions(GREYTHR_URL, ["geolocation"]);

    const page = await browser.newPage();
    await page.setGeolocation({
      latitude: randomLocation.latitude,
      longitude: randomLocation.longitude,
    });

    console.log("🌐 Opening GreytHR login page...");
    await page.goto(GREYTHR_URL, { waitUntil: "networkidle2" });

    // --- LOGIN ---
    await page.waitForSelector("#username", { timeout: 20000 });
    await page.type("#username", EMP_ID, { delay: 100 });
    await page.type("#password", PASSWORD, { delay: 100 });
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {
      console.warn("⚠️ Navigation timeout — continuing...");
    });

    // --- WAIT for attendance widget ---
    console.log("⌛ Waiting for attendance widget to load...");
    await page.waitForSelector("gt-attendance-info", { visible: true, timeout: 60000 });

    // --- Try to click the "Sign Out" button inside shadow DOM ---
    console.log("🔍 Searching for Sign Out button...");

    let success = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      success = await page.evaluate(() => {
        const info = document.querySelector("gt-attendance-info");
        if (!info) return false;
        const btns = info.querySelectorAll("gt-button");
        for (const btn of btns) {
          const shadowBtn = btn.shadowRoot?.querySelector("button");
          if (shadowBtn && shadowBtn.innerText.trim().toLowerCase().includes("sign out")) {
            shadowBtn.click();
            return true;
          }
        }
        return false;
      });

      if (success) {
        console.log(`Found and clicked Sign Out (attempt ${attempt})`);
        break;
      }

      console.log(`⚠️ Attempt ${attempt}: Sign Out not ready yet — waiting 3s...`);
      await new Promise((res) => setTimeout(res, 3000));
    }

    if (!success) throw new Error("Sign Out button not found after multiple attempts");

    console.log("Successfully punched out at:", randomLocation);

    await sendMail(
  "Punch Out Successful",
  `Successfully punched in from location.`,
  true,
  { latitude: randomLocation.lat, longitude: randomLocation.lng }
);


    await browser.close();
  } catch (error) {
    console.error("❌ Punch out failed:", error.message);
    try {
      
await sendMail(
  "Punch In Failed",
  `Error: ${error.message}`,
  false
);
      console.log("📩 Error notification sent");
    } catch (mailErr) {
      console.error("❌ Failed to send error email:", mailErr.message);
    }
    if (browser) await browser.close();
    process.exit(1);
  }
})();
