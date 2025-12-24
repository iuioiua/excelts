#!/usr/bin/env node
// Post-build script for CJS: creates package.json to mark directory as CommonJS
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cjsDir = path.join(__dirname, "../dist/cjs");

fs.writeFileSync(path.join(cjsDir, "package.json"), JSON.stringify({ type: "commonjs" }, null, 2));

console.log("Created dist/cjs/package.json");
