# ExcelTS

[![Build Status](https://github.com/cjnoname/excelts/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/cjnoname/excelts/actions/workflows/ci.yml)

Modern TypeScript Excel Workbook Manager - Read, manipulate and write spreadsheet data and styles to XLSX and JSON.

## About This Project

ExcelTS is a modernized fork of [ExcelJS](https://github.com/exceljs/exceljs) with:

- ✅ **Full TypeScript Support** - Complete type definitions and modern TypeScript patterns
- ✅ **Updated Dependencies** - All dependencies upgraded to latest stable versions
- ✅ **Modern Build System** - Using Rolldown for faster builds
- ✅ **Enhanced Testing** - Migrated to Vitest with browser testing support
- ✅ **ESM First** - Native ES Module support with CommonJS compatibility
- ✅ **Node 20+** - Optimized for modern Node.js versions
- ✅ **Named Exports** - All exports are named for better tree-shaking

## Translations

- [中文文档](README_zh.md)

## Installation

````bash
npm install @cj-tech-master/excelts

## Quick Start

### Creating a Workbook

```javascript
import { Workbook } from "@cj-tech-master/excelts";

const workbook = new Workbook();
const sheet = workbook.addWorksheet("My Sheet");

// Add data
sheet.addRow(["Name", "Age", "Email"]);
sheet.addRow(["John Doe", 30, "john@example.com"]);
sheet.addRow(["Jane Smith", 25, "jane@example.com"]);

// Save to file
await workbook.xlsx.writeFile("output.xlsx");
````

### Reading a Workbook

```javascript
import { Workbook } from "@cj-tech-master/excelts";

const workbook = new Workbook();
await workbook.xlsx.readFile("input.xlsx");

const worksheet = workbook.getWorksheet(1);
worksheet.eachRow((row, rowNumber) => {
  console.log("Row " + rowNumber + " = " + JSON.stringify(row.values));
});
```

### Styling Cells

```javascript
// Set cell value and style
const cell = worksheet.getCell("A1");
cell.value = "Hello";
cell.font = {
  name: "Arial",
  size: 16,
  bold: true,
  color: { argb: "FFFF0000" }
};
cell.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFF00" }
};
```

## Features

- **Excel Operations**
  - Create, read, and modify XLSX files
  - Multiple worksheet support
  - Cell styling (fonts, colors, borders, fills)
  - Cell merging and formatting
  - Row and column properties
  - Freeze panes and split views

- **Data Handling**
  - Rich text support
  - Formulas and calculated values
  - Data validation
  - Conditional formatting
  - Images and charts
  - Hyperlinks
  - Pivot tables

- **Advanced Features**
  - Streaming for large files
  - CSV import/export
  - Tables with auto-filters
  - Page setup and printing options
  - Data protection
  - Comments and notes

## Browser Support

ExcelTS has native browser support with **zero configuration** required for modern bundlers.

### Using with Bundlers (Vite, Webpack, Rollup, esbuild)

Simply import ExcelTS - no polyfills or configuration needed:

```javascript
import { Workbook } from "@cj-tech-master/excelts";

const workbook = new Workbook();
const sheet = workbook.addWorksheet("Sheet1");
sheet.getCell("A1").value = "Hello, Browser!";

// Write to buffer and download
const buffer = await workbook.xlsx.writeBuffer();
const blob = new Blob([buffer], {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
});
const url = URL.createObjectURL(blob);
// ... trigger download
```

### Using with Script Tags (No Bundler)

```html
<script src="https://unpkg.com/@cj-tech-master/excelts/dist/browser/excelts.iife.min.js"></script>
<script>
  const { Workbook } = ExcelTS;
  const wb = new Workbook();
  // ... use workbook API
</script>
```

### Browser-Specific Notes

- **CSV operations are supported** using native RFC 4180 implementation
  - Use `csv.load(stringOrArrayBuffer)` to read CSV
  - Use `csv.writeString()` or `csv.writeBuffer()` to write CSV
- Use `xlsx.load(arrayBuffer)` instead of `xlsx.readFile()`
- Use `xlsx.writeBuffer()` instead of `xlsx.writeFile()`
- Worksheet protection with passwords is fully supported (pure JS SHA-512)

## Requirements

### Node.js

- **Node.js >= 18.0.0** (ES2020 native support)
- Recommended: Node.js >= 20.0.0 for best performance

### Browsers (No Polyfills Required)

- **Chrome >= 85** (August 2020)
- **Edge >= 85** (August 2020)
- **Firefox >= 113** (May 2023)
- **Safari >= 16.4** (March 2023)
- **Opera >= 71** (September 2020)

All modern JavaScript features are natively supported in these versions.

## Maintainer

This project is actively maintained by [CJ (@cjnoname)](https://github.com/cjnoname).

### Maintenance Status

**Active Maintenance** - This project is actively maintained with a focus on:

- 🔒 **Security Updates** - Timely security patches and dependency updates
- 🐛 **Bug Fixes** - Critical bug fixes and stability improvements
- 📦 **Dependency Management** - Keeping dependencies up-to-date and secure
- 🔍 **Code Review** - Reviewing and merging community contributions

### Contributing

While I may not have the bandwidth to develop new features regularly, **community contributions are highly valued and encouraged!**

- 💡 **Pull Requests Welcome** - I will review and merge quality PRs promptly
- 🚀 **Feature Proposals** - Open an issue to discuss new features before implementing
- 🐛 **Bug Reports** - Please report bugs with reproducible examples
- 📖 **Documentation** - Improvements to documentation are always appreciated

## API Documentation

For detailed API documentation, please refer to the comprehensive documentation sections:

- Workbook Management
- Worksheets
- Cells and Values
- Styling
- Formulas
- Data Validation
- Conditional Formatting
- File I/O

The API remains largely compatible with the original ExcelJS.

## Contributing Guidelines

Contributions are welcome! Please feel free to submit a Pull Request.

### Before Submitting a PR

1. **Bug Fixes**: Add a unit-test or integration-test (in the `src/__test__` folder) that reproduces the issue
2. **New Features**: Open an issue first to discuss the feature and implementation approach
3. **Documentation**: Update relevant documentation and type definitions
4. **Code Style**: Follow the existing code style and pass all linters (`npm run lint`)
5. **Tests**: Ensure all tests pass (`npm test`) and add tests for new functionality

### Important Notes

- **Version Numbers**: Please do not modify package version in PRs. Versions are managed through releases.
- **License**: All contributions will be included under the project's MIT license
- **Commit Messages**: Write clear, descriptive commit messages

### Getting Help

If you need help or have questions:

- 📖 Check existing [issues](https://github.com/cjnoname/excelts/issues) and [documentation](https://github.com/cjnoname/excelts)
- 💬 Open a [new issue](https://github.com/cjnoname/excelts/issues/new) for discussion
- 🐛 Use issue templates for bug reports

## License

MIT License

Based on [ExcelJS](https://github.com/exceljs/exceljs) by [Guyon Roche](https://github.com/guyonroche)

## Credits

This project is a fork of ExcelJS with modernization improvements. All credit for the original implementation goes to:

- **Guyon Roche** - Original author of ExcelJS
- All [ExcelJS contributors](https://github.com/exceljs/exceljs/graphs/contributors)

## Links

- [GitHub Repository](https://github.com/cjnoname/exceljs)
- [Original ExcelJS](https://github.com/exceljs/exceljs)
- [Issue Tracker](https://github.com/cjnoname/exceljs/issues)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.
