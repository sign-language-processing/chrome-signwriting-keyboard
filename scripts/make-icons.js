#!/usr/bin/env node
//
// Build the extension icons (16, 48, 128) and the 128 store-listing icon by
// downloading a SignWriting glyph from glyphogram.php and centering it on a
// padded white square.
//
// Output:
//   icons/icon-16.png
//   icons/icon-48.png
//   icons/icon-128.png
//   icons/icon-store-128.png        (same as icon-128 today; separated so
//                                    we can swap for a different design later)

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "icons");
const SIZES = [16, 48, 128];

const GLYPH_URL =
  "https://swis.wmflabs.org/glyphogram.php?text=" +
  "AS10011S10019S2e704S2e748M525x535S2e748483x510S10011501x466S2e704510x500S10019476x475" +
  "&pad=0&size=3&name=Sign";

const PADDING_RATIO = 0.12;

async function fetchGlyph() {
  const res = await fetch(GLYPH_URL);
  if (!res.ok) throw new Error(`glyph fetch failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function makeIcon(glyph, size) {
  const inner = Math.round(size * (1 - 2 * PADDING_RATIO));
  const fitted = await sharp(glyph)
    .resize({ width: inner, height: inner, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  const left = Math.round((size - inner) / 2);
  const top = Math.round((size - inner) / 2);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: fitted, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`fetching ${GLYPH_URL}`);
  const glyph = await fetchGlyph();
  for (const size of SIZES) {
    const buf = await makeIcon(glyph, size);
    await writeFile(join(OUT, `icon-${size}.png`), buf);
    console.log(`  wrote icons/icon-${size}.png (${buf.length} bytes)`);
  }
  const store = await makeIcon(glyph, 128);
  await writeFile(join(OUT, "icon-store-128.png"), store);
  console.log(`  wrote icons/icon-store-128.png`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
