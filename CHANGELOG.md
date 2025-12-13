# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.0] - 2025-12-13

### Added

- `ZipParser` class for cross-platform ZIP parsing (browser + Node.js)
- `extractAll`, `extractFile`, `listFiles`, `forEachEntry` now work in browser environments
- Native `DecompressionStream` support for browser decompression
- Comprehensive tests for new zip-parser module

### Changed

- Refactored `extract.ts` to use `ZipParser` instead of Node.js streams
- Updated tests to use `TextDecoder` instead of `Buffer.toString()`

### Removed

- Unused `global.d.ts` type declarations

### Breaking Changes

- `extractAll`, `extractFile`, `forEachEntry` now return `Uint8Array` instead of `Buffer`

## [1.4.5] - 2025-12-10

### Added

- Proper typing for `Row` and `Cell` classes with JSDoc comments
- Type safety improvements across `Row`, `Cell`, `Anchor`, `Column`, `Range`, `Image`, `Table` and stream classes

### Changed

- Relaxed return types for row methods (`getRow`, `findRow`, `eachRow`) to improve flexibility

## [1.4.4] - 2025-12-08

### Changed

- Replaced fflate with native zlib for ZIP compression (performance improvement)

### Fixed

- Ignore dynamicFilter nodes in filterColumn parsing (#2972)
- Prevent memory overflow when loading files with many definedNames (#2925)
- Prevent string formula results from being converted to date (#2970)
- Handle missing `r` attribute in row and cell elements (#2961)

## [1.4.3] - 2025-12-05

### Fixed

- Date and duration format handling

## [1.4.2] - 2025-12-04

### Changed

- Relaxed performance test thresholds for CI and Windows compatibility

## [1.4.1] - 2025-12-03

### Changed

- Optimized parsing of large data validation ranges (performance improvement)

## [1.4.0] - 2025-12-02

### Changed

- Code cleanup and optimizations

## [1.3.0] - 2025-11-28

### Changed

- Updated all dependencies to latest versions

### Added

- Cell format parser
- Improved browser compatibility

## [1.1.0] - 2025-11-15

### Added

- Major improvements and bug fixes

## [1.0.0] - 2025-10-30

### 🎉 First Stable Release

This is the first stable 1.0 release of ExcelTS! The library is now production-ready with comprehensive features, excellent TypeScript support, and thorough testing.

### Added

- Full TypeScript rewrite with strict typing
- Named exports for better tree-shaking
- Browser testing support with Playwright
- Husky v9 for Git hooks
- lint-staged for pre-commit checks
- Prettier configuration for consistent code style
- .npmignore for optimized package publishing
- Comprehensive browser and Node.js version requirements documentation

### Changed

- Migrated from ExcelJS to ExcelTS
- All default exports converted to named exports
- Updated all dependencies to latest versions
- Migrated testing framework from Mocha to Vitest
- Switched bundler from Webpack to Rolldown
- Build system using tsgo (TypeScript native compiler)
- Target ES2020 for better compatibility
- Node.js requirement: >= 18.0.0 (previously >= 12.0.0)
- Browser requirements: Chrome 85+, Firefox 79+, Safari 14+, Edge 85+, Opera 71+

### Improved

- Enhanced type safety with proper access modifiers
- Performance optimizations in build process
- Reduced package size by excluding source files from npm publish
- Optimized IIFE builds with conditional sourcemaps
- Better error handling and logging (development-only console warnings)

---

## Migration from ExcelJS

If you're migrating from ExcelJS, note these breaking changes:

### Import Changes

```javascript
// Before (ExcelJS)
import ExcelJS from "exceljs";
const workbook = new ExcelJS.Workbook();

// After (ExcelTS)
import { Workbook } from "@cj-tech-master/excelts";
const workbook = new Workbook();
```

### Browser Usage

```javascript
// Before (ExcelJS)
import ExcelJS from "exceljs";

// After (ExcelTS)
import { Workbook } from "@cj-tech-master/excelts/browser";
// Or use IIFE build with <script> tag
```

For more details, see [README.md](README.md).
