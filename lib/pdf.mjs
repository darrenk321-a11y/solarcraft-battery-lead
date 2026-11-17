// Turns proposal HTML into a letter-size PDF with headless Chromium.
// On Netlify, @sparticuz/chromium-min downloads the Chromium pack on a cold
// start (cached in /tmp while the function stays warm).
import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

const PACK_URL = process.env.CHROMIUM_PACK_URL ||
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

export async function htmlToPdf(html) {
  const executablePath = process.env.LOCAL_CHROME_PATH || (await chromium.executablePath(PACK_URL));
  const browser = await puppeteer.launch({
    args: process.env.LOCAL_CHROME_PATH ? ["--no-sandbox"] : puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
    executablePath,
    headless: "shell",
    defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 1 },
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMediaType("print");
    const overflow = await page.evaluate(() => [...document.querySelectorAll(".pg")].map((p) => p.scrollHeight - 1056));
    if (overflow.some((o) => o > 0)) throw new Error(`Proposal page overflow: ${overflow.join(", ")}`);
    const pdf = await page.pdf({ format: "Letter", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
