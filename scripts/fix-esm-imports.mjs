#!/usr/bin/env node
// Post-build script for ESM: adds .js extensions to imports for Node.js ESM compatibility
// Node.js ESM requires explicit file extensions in import statements
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const esmDir = path.join(__dirname, "../dist/esm");

let filesModified = 0;

function addJsExtensions(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      addJsExtensions(filePath);
    } else if (file.endsWith(".js")) {
      let content = fs.readFileSync(filePath, "utf8");
      const originalContent = content;

      // Add .js extensions to relative imports that don't already have them
      // Handles: import { x } from "./path" -> import { x } from "./path.js"
      // And: export { x } from "./path" -> export { x } from "./path.js"
      content = content.replace(
        /((?:import|export)\s*(?:[^'"]*\s+from\s+)?['"])(\.\.?\/[^'"]+?)(?<!\.js)(['"])/g,
        (match, prefix, importPath, suffix) => {
          // Don't add .js if already has an extension or is a directory index
          if (importPath.endsWith(".js") || importPath.endsWith(".json")) {
            return match;
          }
          return `${prefix}${importPath}.js${suffix}`;
        }
      );

      // Handle dynamic imports: import("./path") -> import("./path.js")
      content = content.replace(
        /(import\s*\(\s*['"])(\.\.?\/[^'"]+?)(?<!\.js)(['"]\s*\))/g,
        (match, prefix, importPath, suffix) => {
          if (importPath.endsWith(".js") || importPath.endsWith(".json")) {
            return match;
          }
          return `${prefix}${importPath}.js${suffix}`;
        }
      );

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        filesModified++;
      }
    }
  }
}

console.log("Adding .js extensions to ESM imports for Node.js compatibility...");
addJsExtensions(esmDir);
console.log(`Done! Modified ${filesModified} files.`);
