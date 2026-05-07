import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { launchBrowser } from "../helpers/browser.js";

const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdoLSj4gDvf_X3-vw9uVGlggmC4q-_9N26M5KoR2v1OCAN0dQ/viewform";

let browser;
let cleanup;

before(async () => {
  ({ browser, cleanup } = await launchBrowser());
});

after(async () => {
  if (cleanup) await cleanup();
});

test("Google Form question titled SignWriting gets the edit button", async () => {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(FORM_URL, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForFunction(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--swkb-loaded").trim() === "1"
  );
  await page.waitForSelector(".swkb-edit-button", { timeout: 30000 });

  const enhanced = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input[data-swkb-button="1"]')).map((el) => {
      const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
      const label = ids
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((n) => (n.textContent || "").trim())
        .join(" ")
        .trim();
      return { type: el.type, label };
    })
  );

  assert.ok(enhanced.length > 0, "expected at least one SignWriting input enhanced");
  for (const e of enhanced) {
    const stripped = e.label.replace(/[\s*]+$/, "").toLowerCase();
    assert.equal(stripped, "signwriting", `unexpected label "${e.label}"`);
  }

  await page.close();
});
