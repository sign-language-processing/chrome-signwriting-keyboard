import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

test("manifest.json is a valid Manifest V3 with content_scripts", async () => {
  const m = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
  assert.equal(m.manifest_version, 3);
  assert.ok(m.name && m.version);
  assert.ok(m.description.length <= 132, `description must be ≤132 chars (got ${m.description.length})`);
  assert.ok(m.author && m.homepage_url);
  assert.ok(Array.isArray(m.content_scripts) && m.content_scripts.length > 0);
  assert.deepEqual(m.content_scripts[0].matches, ["http://*/*", "https://*/*"]);
  assert.ok(m.content_scripts[0].js.includes("src/content.js"));
});

test("content.js declares no dangerous APIs", async () => {
  const src = await readFile(resolve(ROOT, "src/content.js"), "utf8");
  assert.doesNotMatch(src, /eval\s*\(/);
  assert.doesNotMatch(src, /Function\s*\(\s*['"]/);
  assert.match(src, /sutton-signwriting\.github\.io/);
});
