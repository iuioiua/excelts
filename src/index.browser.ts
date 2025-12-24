/**
 * Browser entry point - No Node.js dependencies
 * This version is optimized for browser environments with minimal bundle size
 */

// =============================================================================
// Main Classes (Browser-compatible)
// =============================================================================

export { Workbook } from "./doc/workbook.browser";
export { Worksheet } from "./doc/worksheet";
export { Row } from "./doc/row";
export { Column } from "./doc/column";
export { Cell } from "./doc/cell";
export { Range } from "./doc/range";
export { Image } from "./doc/image";
export * from "./doc/anchor";
export { Table } from "./doc/table";
export { DataValidations } from "./doc/data-validations";

// =============================================================================
// Enums
// =============================================================================

export * from "./doc/enums";

// =============================================================================
// Types
// =============================================================================

// Export all type definitions from types.ts
export * from "./types";

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
} from "./doc/pivot-table";

// =============================================================================
// Utilities
// =============================================================================

export * from "./utils/sheet-utils";

// =============================================================================
// CSV support (using native RFC 4180 implementation)
// =============================================================================
export type { CsvReadOptions, CsvWriteOptions } from "./csv/csv";

// =============================================================================
// NOTE: The following are NOT exported in browser build (Node.js only):
// - WorkbookWriter, WorkbookReader (streaming classes for file I/O)
// - WorksheetWriter, WorksheetReader (streaming classes)
// - ModelContainer
// =============================================================================
