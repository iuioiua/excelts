/**
 * Browser entry point - No Node.js dependencies
 * This version is optimized for browser environments with minimal bundle size
 */

// =============================================================================
// Main Classes (Browser-compatible)
// =============================================================================

export { Workbook } from "./doc/workbook.browser.js";
export { Worksheet } from "./doc/worksheet.js";
export { Row } from "./doc/row.js";
export { Column } from "./doc/column.js";
export { Cell } from "./doc/cell.js";
export { Range } from "./doc/range.js";
export { Image } from "./doc/image.js";
export * from "./doc/anchor.js";
export { Table } from "./doc/table.js";
export { DataValidations } from "./doc/data-validations.js";

// =============================================================================
// Enums
// =============================================================================

export * from "./doc/enums.js";

// =============================================================================
// Types
// =============================================================================

// Export all type definitions from types.ts
export * from "./types.js";

// Export pivot table types (type-only, no runtime dependency)
export type {
  PivotTable,
  PivotTableModel,
  PivotTableSource,
  CacheField,
  DataField,
  PivotTableSubtotal,
  ParsedCacheDefinition,
  ParsedCacheRecords
} from "./doc/pivot-table.js";

// =============================================================================
// Utilities
// =============================================================================

export * from "./utils/sheet-utils.js";

// =============================================================================
// CSV support (using native RFC 4180 implementation)
// =============================================================================
export type { CsvReadOptions, CsvWriteOptions } from "./csv/csv.js";

// =============================================================================
// NOTE: The following are NOT exported in browser build (Node.js only):
// - WorkbookWriter, WorkbookReader (streaming classes for file I/O)
// - WorksheetWriter, WorksheetReader (streaming classes)
// - ModelContainer
// =============================================================================
