#!/usr/bin/env node
import { mkdir, rm, copyFile, readdir, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = join(ROOT, "dist");
const PKG = join(ROOT, "dist-pkg");

const FILES = ["manifest.json"];
const DIRS = ["src", "icons"];

async function copyDir(src, dst) {
  await mkdir(dst, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = join(src, entry.name);
    const d = join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else {
      await copyFile(s, d);
    }
  }
}

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await rm(PKG, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await mkdir(PKG, { recursive: true });

  for (const f of FILES) {
    if (existsSync(join(ROOT, f))) {
      await copyFile(join(ROOT, f), join(DIST, f));
    }
  }
  for (const d of DIRS) {
    if (existsSync(join(ROOT, d))) {
      await copyDir(join(ROOT, d), join(DIST, d));
    }
  }

  const manifest = JSON.parse(await readFile(join(DIST, "manifest.json"), "utf8"));
  const zipName = `signwriting-keyboard-${manifest.version}.zip`;
  const zipPath = join(PKG, zipName);

  const result = spawnSync("zip", ["-r", zipPath, "."], { cwd: DIST, stdio: "inherit" });
  if (result.status !== 0) {
    console.error("zip command failed");
    process.exit(1);
  }

  const s = await stat(zipPath);
  console.log(`Built ${zipPath} (${(s.size / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
