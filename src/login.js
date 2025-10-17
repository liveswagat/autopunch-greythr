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
  console.log("🎉 Holiday or weekend — skipping punch in.");
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

    // Login
    await page.waitForSelector("#username", { timeout: 20000 });
    await page.type("#username", EMP_ID, { delay: 100 });
    await page.type("#password", PASSWORD, { delay: 100 });
    await page.click('button[type="submit"]');

    // Wait for dashboard (SPA)
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {
      console.warn("⚠️ Navigation timeout — continuing (SPA detected)...");
    });

    // Wait for buttons container
    await page.waitForSelector(".btn-container", { visible: true, timeout: 30000 });

    // Find all gt-button inside btn-container
    const gtButtons = await page.$$(".btn-container gt-button");
    let targetButtonHandle = null;

    for (const btnHandle of gtButtons) {
      const shadowBtnHandle = await btnHandle.evaluateHandle(btn => {
        const shadowBtn = btn.shadowRoot.querySelector("button");
        if (shadowBtn && shadowBtn.innerText.trim() === "Sign In") return shadowBtn;
        return null;
      });

      const exists = await shadowBtnHandle.jsonValue();
      if (exists) {
        targetButtonHandle = shadowBtnHandle;
        break;
      }
    }

    if (!targetButtonHandle) throw new Error("Sign In button not found");

    // Scroll into view and click
    await targetButtonHandle.evaluate(btn => {
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
      btn.focus();
      btn.click();
    });

    // Optional: wait for confirmation text (Sign In)
    await page.waitForFunction(() => {
      const attendanceInfo = document.querySelector("gt-attendance-info");
      const gtButton = attendanceInfo?.querySelector("gt-button");
      const shadowBtn = gtButton?.shadowRoot?.querySelector("button");
      return shadowBtn?.innerText.toLowerCase().includes("signed in");
    }, { timeout: 5000 }).catch(() => {
      console.warn("⚠️ Could not confirm punch in text — continuing...");
    });

    console.log("✅ Successfully punched in at:", randomLocation);

    await sendMail(
  "✅ Punch In Successful",
  `Successfully punched in from location.`,
  true,
  { latitude: randomLocation.lat, longitude: randomLocation.lng }
);

    await browser.close();
  } catch (error) {
    console.error("❌ Punch in failed:", error.message);

    try {
     await sendMail(
  "❌ Punch In Failed",
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
