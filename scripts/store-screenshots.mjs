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

    // Wait for the SignMaker frame itself to load (cross-origin iframe, but
    // we can still address it as a Frame and wait for known UI to render).
    const deadline = Date.now() + 30000;
    let signmakerFrame;
    while (Date.now() < deadline) {
      signmakerFrame = page.frames().find((f) => f.url().startsWith("https://www.sutton-signwriting.io/signmaker/"));
      if (signmakerFrame) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!signmakerFrame) throw new Error("signmaker iframe never attached");
    console.log("found iframe at", signmakerFrame.url());

    // Cross-origin frames still expose evaluate(); wait for SignMaker's main
    // grid layout and its symbol palette to be rendered.
    await signmakerFrame.waitForFunction(
      () => document.querySelectorAll(".cmd, .cmdslim").length > 10,
      { timeout: 30000 }
    ).catch((e) => console.log("frame wait failed:", e.message));
    // Final settle for layout and font paint.
    await new Promise((r) => setTimeout(r, 2000));

    await page.screenshot({ path: join(OUT, "screenshot-2-modal.png") });
    console.log("wrote screenshot-2-modal.png");

    // Also dump the modal element on its own (no backdrop, no host page)
    // so we have a tight crop showing just the embedded SignMaker keyboard.
    const modal = await page.$(".swkb-modal");
    if (modal) {
      await modal.screenshot({ path: join(OUT, "screenshot-2-modal-clipped.png") });
      console.log("wrote screenshot-2-modal-clipped.png");
    }

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
