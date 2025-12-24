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

// Browser alias - redirect Node.js modules to browser-specific implementations
// Use absolute paths for both find and replacement
const srcPath = path.resolve("./src");
const browserAlias = {
  // Core modules with platform-specific implementations
  [path.join(srcPath, "doc/workbook")]: path.join(srcPath, "doc/workbook.browser.ts"),
  [path.join(srcPath, "xlsx/xlsx")]: path.join(srcPath, "xlsx/xlsx.browser.ts"),
  [path.join(srcPath, "csv/csv")]: path.join(srcPath, "csv/csv.browser.ts"),

  // Utility modules - browser versions use Web APIs instead of Node.js APIs
  [path.join(srcPath, "utils/stream-buf")]: path.join(srcPath, "utils/stream-buf.browser.ts"),
  [path.join(srcPath, "utils/zip-stream")]: path.join(srcPath, "utils/zip-stream.browser.ts"),
  [path.join(srcPath, "utils/encryptor")]: path.join(srcPath, "utils/encryptor.browser.ts"),
  [path.join(srcPath, "utils/utils")]: path.join(srcPath, "utils/utils.browser.ts"),

  // ZIP utilities - browser versions use CompressionStream instead of Node.js zlib
  [path.join(srcPath, "utils/zip/crc32")]: path.join(srcPath, "utils/zip/crc32.browser.ts"),
  [path.join(srcPath, "utils/zip/compress")]: path.join(srcPath, "utils/zip/compress.browser.ts")
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
