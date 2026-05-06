import puppeteer from "puppeteer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const EXTENSION_PATH = resolve(__dirname, "..", "..");

export async function launchBrowser({ headless } = {}) {
  const userDataDir = await mkdtemp(join(tmpdir(), "swkb-"));
  const useHeadless = headless ?? (process.env.HEADLESS !== "false");
  const browser = await puppeteer.launch({
    headless: useHeadless ? "new" : false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
    userDataDir,
    defaultViewport: { width: 1100, height: 800 },
  });
  return {
    browser,
    cleanup: async () => {
      await browser.close().catch(() => {});
      await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

export const SIGNMAKER_PREFIX = "https://www.sutton-signwriting.io/signmaker/";

export function makeSignMakerStub(swu) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>SignMaker Stub</title>
<style>body{font:14px sans-serif;margin:20px;background:#f9fafb}#save{padding:10px 16px;background:#3b82f6;color:#fff;border:0;border-radius:4px;cursor:pointer;font-size:14px}</style>
</head>
<body>
  <h2>SignMaker Stub</h2>
  <p>Stubbed iframe — auto-posts a save message after 50ms.</p>
  <button id="save" type="button">Save now</button>
  <pre id="log" style="background:#fff;padding:8px;border:1px solid #ddd;border-radius:4px;max-width:600px;white-space:pre-wrap;"></pre>
  <script>
    const SWU = ${JSON.stringify(swu)};
    const log = (m) => { document.getElementById("log").textContent += m + "\\n"; };
    log("hash=" + window.location.hash);
    function postSave() {
      window.parent.postMessage({ signmaker: "save", swu: SWU }, "*");
      log("posted save: " + SWU);
    }
    document.getElementById("save").addEventListener("click", postSave);
    setTimeout(postSave, 50);
  </script>
</body></html>`;
}

export async function interceptSignMaker(page, swu) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith(SIGNMAKER_PREFIX)) {
      req.respond({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: makeSignMakerStub(swu),
      });
    } else {
      req.continue();
    }
  });
}

export async function blockSignMaker(page) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().startsWith(SIGNMAKER_PREFIX)) req.abort();
    else req.continue();
  });
}

export async function settle(page) {
  await page.evaluate(() =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  );
}
