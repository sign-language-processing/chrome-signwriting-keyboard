import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { startStaticServer } from "../helpers/server.js";
import { launchBrowser, interceptSignMaker, blockSignMaker, settle, EXTENSION_PATH } from "../helpers/browser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "..", "..", "e2e-output");
const FIXTURES = resolve(EXTENSION_PATH, "test", "fixtures");
const EXPECTED_SWU = "𝠀񁳴񁳶񉌍񉌕񁳲񁳸𝠃𝤭𝤩񁳼𝣭𝣤񁳴𝤉𝣤񉌍𝤡𝣺񉌕𝣠𝣺񁳺𝣭𝤑񁳲𝤉𝤑";

let server;
let browser;
let cleanup;

before(async () => {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  server = await startStaticServer(FIXTURES);
  ({ browser, cleanup } = await launchBrowser());
});

after(async () => {
  if (cleanup) await cleanup();
  if (server) await server.close();
});

async function newPage() {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => console.error("[pageerror]", e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("[page console]", msg.text());
  });
  return page;
}

async function gotoTestPage(page) {
  await page.goto(`${server.url}/test-page.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--swkb-loaded").trim() === "1"
  );
  await page.waitForSelector(".swkb-edit-button");
}

test("recognizes inputs (not textareas) whose attributes equal SignWriting", async () => {
  const page = await newPage();
  await gotoTestPage(page);

  const enhancedIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input, textarea"))
      .filter((el) => el.dataset.swkbButton === "1")
      .map((el) => el.id)
  );
  assert.deepEqual(
    enhancedIds.sort(),
    ["by-aria", "by-data-type", "by-label", "by-labelledby", "by-placeholder", "prefilled"].sort()
  );

  const textareaEnhanced = await page.$eval("#by-textarea",
    (el) => el.dataset.swkbButton === "1");
  assert.equal(textareaEnhanced, false, "textarea must not be enhanced");

  await page.screenshot({ path: join(SCREENSHOT_DIR, "01-page-loaded.png"), fullPage: true });
  await page.close();
});

test("opens modal when SignWriting input is focused", async () => {
  const page = await newPage();
  await gotoTestPage(page);

  await page.focus("#by-placeholder");
  await page.waitForSelector(".swkb-modal-backdrop.swkb-open", { visible: true });

  const iframeSrc = await page.$eval(".swkb-iframe", (el) => el.src);
  assert.match(iframeSrc, /^https:\/\/www\.sutton-signwriting\.io\/signmaker\/index\.html#\?/);
  assert.match(iframeSrc, /skin=colorful/);
  assert.match(iframeSrc, /grid=2/);

  await page.screenshot({ path: join(SCREENSHOT_DIR, "02-modal-open.png"), fullPage: true });
  await page.close();
});

test("does not open modal for non-matching inputs", async () => {
  const page = await newPage();
  await gotoTestPage(page);

  await page.focus("#plain");
  await settle(page);
  const open = await page.$(".swkb-modal-backdrop.swkb-open");
  assert.equal(open, null);

  await page.close();
});

test("closes modal when × is clicked", async () => {
  const page = await newPage();
  await gotoTestPage(page);

  await page.focus("#by-placeholder");
  await page.waitForSelector(".swkb-modal-backdrop.swkb-open");
  await page.click(".swkb-close");
  await page.waitForFunction(
    () => !document.querySelector(".swkb-modal-backdrop.swkb-open")
  );
  await page.close();
});

test("closes modal on Escape", async () => {
  const page = await newPage();
  await gotoTestPage(page);

  await page.focus("#by-placeholder");
  await page.waitForSelector(".swkb-modal-backdrop.swkb-open");
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => !document.querySelector(".swkb-modal-backdrop.swkb-open")
  );
  await page.close();
});

test("save message updates input value, dispatches events, and closes modal", async () => {
  const page = await newPage();
  await interceptSignMaker(page, EXPECTED_SWU);
  await gotoTestPage(page);

  await page.focus("#by-placeholder");
  await page.waitForSelector(".swkb-modal-backdrop.swkb-open");

  await page.waitForFunction(
    (sel, expected) => document.querySelector(sel).value === expected,
    { timeout: 10000 },
    "#by-placeholder",
    EXPECTED_SWU
  );

  await page.waitForFunction(() => !document.querySelector(".swkb-modal-backdrop.swkb-open"));

  const finalValue = await page.$eval("#by-placeholder", (el) => el.value);
  assert.equal(finalValue, EXPECTED_SWU);

  await page.screenshot({ path: join(SCREENSHOT_DIR, "03-after-save.png"), fullPage: true });
  await page.close();
});

test("cancel message from SignMaker closes the modal without changing value", async () => {
  const page = await newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().startsWith("https://www.sutton-signwriting.io/signmaker/")) {
      req.respond({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html><body><script>
          setTimeout(() => parent.postMessage({signmaker:"cancel"}, "*"), 50);
        </script></body></html>`,
      });
    } else {
      req.continue();
    }
  });
  await gotoTestPage(page);

  await page.focus("#by-placeholder");
  await page.waitForSelector(".swkb-modal-backdrop.swkb-open");

  await page.waitForFunction(() => !document.querySelector(".swkb-modal-backdrop.swkb-open"));
  const value = await page.$eval("#by-placeholder", (el) => el.value);
  assert.equal(value, "", "value must remain empty on cancel");
  await page.close();
});

test("ignores postMessage from foreign origins", async () => {
  const page = await newPage();
  await gotoTestPage(page);
  await page.focus("#by-placeholder");
  await page.waitForSelector(".swkb-modal-backdrop.swkb-open");

  await page.evaluate(() => {
    window.postMessage({ signmaker: "save", swu: "WONT_LAND" }, "*");
  });
  await settle(page);
  const open = await page.$(".swkb-modal-backdrop.swkb-open");
  const val = await page.$eval("#by-placeholder", (el) => el.value);
  assert.notEqual(open, null, "modal must stay open");
  assert.equal(val, "");
  await page.close();
});

test("dynamically added SignWriting input gets enhanced", async () => {
  const page = await newPage();
  await gotoTestPage(page);

  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "dynamic";
    input.placeholder = "SignWriting";
    document.body.appendChild(input);
  });

  await page.waitForFunction(
    () => document.querySelector("#dynamic")?.dataset.swkbButton === "1"
  );

  await page.close();
});

test("input becomes enhanced when an attribute is mutated to SignWriting", async () => {
  const page = await newPage();
  await gotoTestPage(page);

  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "mutated";
    document.body.appendChild(input);
  });

  await page.evaluate(() => {
    document.querySelector("#mutated").setAttribute("data-kind", "SignWriting");
  });

  await page.waitForFunction(
    () => document.querySelector("#mutated")?.dataset.swkbButton === "1"
  );

  await page.close();
});

test("read-only SWU display element gets 1D font class and a hover overlay", async () => {
  const page = await newPage();
  await gotoTestPage(page);

  const enhanced = await page.evaluate(() => ({
    swu: document.getElementById("display-swu").classList.contains("swkb-display"),
    noSwu: document.getElementById("display-no-swu").classList.contains("swkb-display"),
    noLabel: document.getElementById("display-no-label").classList.contains("swkb-display"),
  }));
  assert.equal(enhanced.swu, true, "display-swu should be enhanced");
  assert.equal(enhanced.noSwu, false, "display-no-swu must NOT be enhanced (no SWU content)");
  assert.equal(enhanced.noLabel, false, "display-no-label must NOT be enhanced (no SignWriting label)");

  await page.hover("#display-swu");
  await page.waitForFunction(() => {
    const o = document.querySelector(".swkb-hover-overlay.swkb-show");
    return !!o && !!o.querySelector("svg");
  }, { timeout: 15000 });

  const overlayInfo = await page.evaluate(() => {
    const svg = document.querySelector(".swkb-hover-overlay.swkb-show svg");
    return svg ? { hasViewBox: svg.hasAttribute("viewBox"), textCount: svg.querySelectorAll("text").length } : null;
  });
  assert.ok(overlayInfo, "expected hover overlay with svg");
  assert.ok(overlayInfo.hasViewBox);
  assert.ok(overlayInfo.textCount > 0);

  await page.screenshot({ path: join(SCREENSHOT_DIR, "05-display-hover.png"), fullPage: true });

  await page.mouse.move(0, 0);
  await page.waitForFunction(() => !document.querySelector(".swkb-hover-overlay.swkb-show"));

  await page.close();
});

test("prefilled input renders an SVG preview once fonts load", async () => {
  const page = await newPage();
  await gotoTestPage(page);

  await page.waitForFunction(
    (sel) => {
      const preview = document.querySelector(`.swkb-preview[data-for="${sel}"]`);
      return !!preview && !!preview.querySelector("svg");
    },
    { timeout: 15000 },
    await page.$eval("#prefilled", (el) => el.dataset.swkbId)
  );

  const svgInfo = await page.evaluate(() => {
    const id = document.getElementById("prefilled").dataset.swkbId;
    const svg = document.querySelector(`.swkb-preview[data-for="${id}"] svg`);
    return svg ? { hasViewBox: svg.hasAttribute("viewBox"), textCount: svg.querySelectorAll("text").length } : null;
  });
  assert.ok(svgInfo, "expected an svg in the preview");
  assert.ok(svgInfo.hasViewBox, "expected svg with viewBox");
  assert.ok(svgInfo.textCount > 0, "expected svg to contain rendered glyph <text> elements");

  await page.screenshot({ path: join(SCREENSHOT_DIR, "04-preview-rendered.png"), fullPage: true });
  await page.close();
});

test("prefilled input value is forwarded to SignMaker via the swu URL param", async () => {
  const page = await newPage();
  await blockSignMaker(page);
  await gotoTestPage(page);

  await page.focus("#prefilled");
  await page.waitForSelector(".swkb-modal-backdrop.swkb-open", { visible: true });

  const iframeSrc = await page.$eval(".swkb-iframe", (el) => el.src);
  const expectedValue = await page.$eval("#prefilled", (el) => el.value);
  const params = new URLSearchParams(new URL(iframeSrc).hash.replace(/^#\??/, ""));
  assert.equal(params.get("swu"), expectedValue);

  await page.close();
});
