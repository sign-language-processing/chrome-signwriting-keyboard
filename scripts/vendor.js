#!/usr/bin/env node
import { mkdir, copyFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "node_modules", "@sutton-signwriting", "font-ttf");
const DST = join(ROOT, "vendor");

const FILES = [
  ["index.min.js", "font-ttf.min.js"],
  ["font/SuttonSignWritingLine.ttf", "fonts/SuttonSignWritingLine.ttf"],
  ["font/SuttonSignWritingFill.ttf", "fonts/SuttonSignWritingFill.ttf"],
];

await rm(DST, { recursive: true, force: true });
await mkdir(join(DST, "fonts"), { recursive: true });
for (const [from, to] of FILES) {
  await copyFile(join(SRC, from), join(DST, to));
}
console.log(`Vendored ${FILES.length} files into ${DST}`);
