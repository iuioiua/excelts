// =============================================================================
// Main Classes
// =============================================================================

export { Workbook } from "./doc/workbook.js";
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
// Node.js Only: Streaming Classes
// These can also be accessed via Workbook.createStreamWriter/createStreamReader
// =============================================================================

export { WorkbookWriter } from "./stream/xlsx/workbook-writer.js";
export { WorkbookReader } from "./stream/xlsx/workbook-reader.js";
export { WorksheetWriter } from "./stream/xlsx/worksheet-writer.js";
export { WorksheetReader } from "./stream/xlsx/worksheet-reader.js";
export { ModelContainer } from "./doc/modelcontainer.js";

// =============================================================================
// Enums
// =============================================================================

export * from "./doc/enums.js";

// =============================================================================
// Types
// =============================================================================

// Export all type definitions from types.ts
export * from "./types.js";

// Pivot table types
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

// Node.js Only: Streaming reader types
export type {
  WorkbookReaderOptions,
  ParseEvent,
  SharedStringEvent,
  WorksheetReadyEvent,
  HyperlinksEvent
} from "./stream/xlsx/workbook-reader.js";

export type {
  WorksheetReaderOptions,
  WorksheetEvent,
  RowEvent,
  HyperlinkEvent,
  WorksheetHyperlink
} from "./stream/xlsx/worksheet-reader.js";

// Node.js Only: Streaming writer types
export type {
  WorkbookWriterOptions,
  ZipOptions,
  ZlibOptions
} from "./stream/xlsx/workbook-writer.js";

// Node.js CSV types and stream classes (native implementation)
export type {
  CsvReadOptions,
  CsvWriteOptions,
  CsvStreamReadOptions,
  CsvStreamWriteOptions
} from "./csv/csv.js";
export { CsvParserStream, CsvFormatterStream } from "./csv/csv.js";

// =============================================================================
// Utilities
// =============================================================================

export * from "./utils/sheet-utils.js";
