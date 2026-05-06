#!/usr/bin/env node
//
// Upload (and optionally publish) the built zip to the Chrome Web Store.
//
// Usage:
//   node scripts/publish.mjs                         # dry run
//   node scripts/publish.mjs --upload                # upload only
//   node scripts/publish.mjs --upload --publish      # upload + publish for review
//
// Auth: a Google service account JSON, either at the path in
//   $CHROME_SERVICE_ACCOUNT_JSON (default ~/Downloads/sign-devops-060fb6499b07.json
//   if it exists), or passed with --key=PATH. The service account email must
//   already be added to the Web Store dev console under Account → Service account.
//
// Extension id: $CHROME_EXTENSION_ID (or --id=…).

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function parseArgs() {
  const out = { upload: false, publish: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--upload") out.upload = true;
    else if (arg === "--publish") out.publish = true;
    else if (arg.startsWith("--key=")) out.key = arg.slice(6);
    else if (arg.startsWith("--id=")) out.id = arg.slice(5);
    else if (arg.startsWith("--zip=")) out.zip = arg.slice(6);
    else if (arg === "-h" || arg === "--help") {
      console.log(`Usage: node scripts/publish.mjs [--upload] [--publish] [--key=PATH] [--id=EXT_ID] [--zip=PATH]`);
      process.exit(0);
    }
  }
  return out;
}

function findKeyPath(arg) {
  if (arg) return resolve(arg);
  if (process.env.CHROME_SERVICE_ACCOUNT_JSON) return resolve(process.env.CHROME_SERVICE_ACCOUNT_JSON);
  const fallback = resolve(process.env.HOME, "Downloads", "sign-devops-060fb6499b07.json");
  if (existsSync(fallback)) return fallback;
  throw new Error("Service account JSON not found. Set CHROME_SERVICE_ACCOUNT_JSON or pass --key=PATH");
}

async function listZip() {
  const { readdir } = await import("node:fs/promises");
  const dir = join(ROOT, "dist-pkg");
  if (!existsSync(dir)) throw new Error(`${dir} not found — run \`npm run build\` first`);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".zip")).map((f) => join(dir, f));
  if (!files.length) throw new Error(`no zip in ${dir} — run \`npm run build\``);
  return files.sort().pop();
}

function base64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(saJson, scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: saJson.client_email,
    scope,
    aud: saJson.token_uri,
    exp: now + 3600,
    iat: now,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  signer.end();
  const sig = base64url(signer.sign(saJson.private_key));
  const jwt = `${header}.${claim}.${sig}`;

  const res = await fetch(saJson.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.access_token;
}

async function upload(token, extensionId, zipPath) {
  const body = await readFile(zipPath);
  const res = await fetch(
    `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${extensionId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-goog-api-version": "2",
      },
      body,
    }
  );
  const j = await res.json();
  if (!res.ok || j.uploadState !== "SUCCESS") {
    throw new Error(`upload failed: ${JSON.stringify(j, null, 2)}`);
  }
  return j;
}

async function publish(token, extensionId) {
  const res = await fetch(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${extensionId}/publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-goog-api-version": "2",
        "content-length": "0",
      },
    }
  );
  const j = await res.json();
  if (!res.ok) throw new Error(`publish failed: ${JSON.stringify(j, null, 2)}`);
  return j;
}

async function main() {
  const args = parseArgs();
  const keyPath = findKeyPath(args.key);
  const extensionId = args.id || process.env.CHROME_EXTENSION_ID || "gphbgcmncjcglnmcenleihlhdhabghpj";
  const zipPath = args.zip ? resolve(args.zip) : await listZip();

  console.log(`zip:          ${zipPath}`);
  console.log(`extension id: ${extensionId}`);
  console.log(`service acct: ${keyPath}`);

  const sa = JSON.parse(await readFile(keyPath, "utf8"));
  console.log(`sa email:     ${sa.client_email}`);

  if (!args.upload && !args.publish) {
    console.log(`\n(dry run — pass --upload to push the zip, --publish to also submit for review)`);
    return;
  }

  console.log("\nMinting access token...");
  const token = await getAccessToken(sa, "https://www.googleapis.com/auth/chromewebstore");
  console.log("token acquired");

  if (args.upload) {
    console.log("\nUploading zip...");
    const r = await upload(token, extensionId, zipPath);
    console.log("upload result:", { state: r.uploadState, id: r.id, kind: r.kind });
  }

  if (args.publish) {
    console.log("\nSubmitting for publish...");
    const r = await publish(token, extensionId);
    console.log("publish result:", r);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
