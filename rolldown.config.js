import { defineConfig } from "rolldown";
import fs from "fs";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const banner = `/*!
 * ${pkg.name} v${pkg.version}
 * ${pkg.description}
 * (c) ${new Date().getFullYear()} ${pkg.author.name}
 * Released under the ${pkg.license} License
 */`;

const createAnalyzePlugin = (filename, open = false) =>
  process.env.ANALYZE
    ? [
        visualizer({
          filename,
          open,
          gzipSize: true,
          brotliSize: true
        })
      ]
    : [];

// Browser alias - redirect Node.js dependent modules to browser versions
// Use absolute paths for both find and replacement
const srcPath = path.resolve("./src");
const browserAlias = {
  // Redirect to browser-specific implementations using absolute paths
  [path.join(srcPath, "doc/workbook.js")]: path.join(srcPath, "doc/workbook.browser.ts"),
  [path.join(srcPath, "utils/stream-buf.js")]: path.join(srcPath, "utils/stream-buf.browser.ts"),
  [path.join(srcPath, "utils/zip-stream.js")]: path.join(srcPath, "utils/zip-stream.browser.ts"),
  [path.join(srcPath, "utils/encryptor.js")]: path.join(srcPath, "utils/encryptor.browser.ts"),
  [path.join(srcPath, "utils/utils.js")]: path.join(srcPath, "utils/utils.browser.ts"),
  [path.join(srcPath, "xlsx/xlsx.js")]: path.join(srcPath, "xlsx/xlsx.browser.ts"),
  // ZIP utilities - browser versions without Node.js zlib dependency
  [path.join(srcPath, "utils/zip/crc32.js")]: path.join(srcPath, "utils/zip/crc32.browser.ts"),
  [path.join(srcPath, "utils/zip/compress.js")]: path.join(srcPath, "utils/zip/compress.browser.ts")
};

// Common config shared by both builds
// Browser version now has NO Node.js polyfills - pure browser code
const commonConfig = {
  input: "./src/index.browser.ts",
  external: ["@aws-sdk/client-s3"],
  platform: "browser",
  tsconfig: "./tsconfig.json",
  resolve: {
    alias: browserAlias
  }
};

const copyLicensePlugin = {
  name: "copy-license",
  writeBundle() {
    if (!fs.existsSync("./dist")) {
      fs.mkdirSync("./dist", { recursive: true });
    }
    fs.copyFileSync("./LICENSE", "./dist/LICENSE");
  }
};

export default defineConfig([
  // Browser ESM: excelts.esm.js (for Vite/Webpack bundlers - zero config)
  {
    ...commonConfig,
    output: {
      dir: "./dist/browser",
      format: "esm",
      sourcemap: true,
      banner,
      entryFileNames: "excelts.esm.js"
    },
    plugins: [copyLicensePlugin, ...createAnalyzePlugin("./dist/stats-esm.html")]
  },
  // Browser ESM minified: excelts.esm.min.js
  {
    ...commonConfig,
    output: {
      dir: "./dist/browser",
      format: "esm",
      sourcemap: false,
      banner,
      minify: true,
      entryFileNames: "excelts.esm.min.js"
    },
    plugins: createAnalyzePlugin("./dist/stats-esm-min.html")
  },
  // Browser IIFE: excelts.iife.js (for development/debugging with <script> tag)
  {
    ...commonConfig,
    output: {
      dir: "./dist/browser",
      format: "iife",
      name: "ExcelTS",
      sourcemap: true,
      banner,
      exports: "named",
      entryFileNames: "excelts.iife.js"
    },
    plugins: createAnalyzePlugin("./dist/stats-iife.html")
  },
  // Browser: excelts.iife.min.js (for production with <script> tag)
  {
    ...commonConfig,
    output: {
      dir: "./dist/browser",
      format: "iife",
      name: "ExcelTS",
      sourcemap: false,
      banner,
      exports: "named",
      minify: true,
      entryFileNames: "excelts.iife.min.js"
    },
    plugins: createAnalyzePlugin("./dist/stats-iife-min.html", true)
  }
]);
