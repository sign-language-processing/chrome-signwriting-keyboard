#!/usr/bin/env node
//
// Generate 1280x800 screenshots for the Chrome Web Store listing. Loads the
// extension as unpacked from the project root and drives the test page.
//
// Output: store-assets/screenshot-{1..3}.png

import puppeteer from "puppeteer";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startStaticServer } from "../test/helpers/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FIXTURES = resolve(ROOT, "test", "fixtures");
const OUT = resolve(ROOT, "store-assets");

const STUB_SAVE_SWU = "𝠀񁳴񁳶񉌍񉌕񁳲񁳸𝠃𝤭𝤩񁳼𝣭𝣤񁳴𝤉𝣤񉌍𝤡𝣺񉌕𝣠𝣺񁳺𝣭𝤑񁳲𝤉𝤑";

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = await startStaticServer(FIXTURES);
  const userDataDir = await mkdtemp(join(tmpdir(), "swkb-store-"));
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--disable-extensions-except=${ROOT}`,
      `--load-extension=${ROOT}`,
      "--no-sandbox",
    ],
    userDataDir,
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.url}/test-page.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".swkb-edit-button");
    await page.screenshot({ path: join(OUT, "screenshot-1-fields.png") });
    console.log("wrote screenshot-1-fields.png");

    // Open the modal on the prefilled input so SignMaker loads with an actual
    // sign on its canvas (not an empty yellow grid that looks like a bug).
    await page.focus("#prefilled");
    await page.waitForSelector(".swkb-modal-backdrop.swkb-open");
    await new Promise((r) => setTimeout(r, 6000));
    await page.screenshot({ path: join(OUT, "screenshot-2-modal.png") });
    console.log("wrote screenshot-2-modal.png");

    // For the third screenshot, just paint the saved value into the input
    // directly (the actual postMessage round-trip from SignMaker can't be
    // simulated cleanly from puppeteer's main-world context).
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector(".swkb-modal-backdrop.swkb-open")
    );
    await page.evaluate((swu) => {
      const el = document.getElementById("by-placeholder");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(el, swu);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, STUB_SAVE_SWU);
    await page.screenshot({ path: join(OUT, "screenshot-3-after-save.png") });
    console.log("wrote screenshot-3-after-save.png");
  } finally {
    await browser.close();
    await rm(userDataDir, { recursive: true, force: true });
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
