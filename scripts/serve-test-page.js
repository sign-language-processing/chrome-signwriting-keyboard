#!/usr/bin/env node
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startStaticServer } from "../test/helpers/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "..", "test", "fixtures");
const port = Number(process.env.PORT || 5173);

const server = await startStaticServer(FIXTURES, port);
console.log(`Test page:  ${server.url}/test-page.html`);
console.log(`(serving:   ${FIXTURES})`);
console.log("\nTo load the extension:");
console.log("  1. open chrome://extensions");
console.log("  2. enable Developer mode");
console.log(`  3. click \"Load unpacked\" and pick ${resolve(__dirname, "..")}`);
console.log("  4. open the test page above");
console.log("\nCtrl+C to stop.");
