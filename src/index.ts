// =============================================================================
// Main Classes
// =============================================================================

export { Workbook } from "./doc/workbook";
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
// Node.js Only: Streaming Classes
// These can also be accessed via Workbook.createStreamWriter/createStreamReader
// =============================================================================

export { WorkbookWriter } from "./stream/xlsx/workbook-writer";
export { WorkbookReader } from "./stream/xlsx/workbook-reader";
export { WorksheetWriter } from "./stream/xlsx/worksheet-writer";
export { WorksheetReader } from "./stream/xlsx/worksheet-reader";
export { ModelContainer } from "./doc/modelcontainer";

// =============================================================================
// Enums
// =============================================================================

export * from "./doc/enums";

// =============================================================================
// Types
// =============================================================================

// Export all type definitions from types.ts
export * from "./types";

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
} from "./doc/pivot-table";

// Node.js Only: Streaming reader types
export type {
  WorkbookReaderOptions,
  ParseEvent,
  SharedStringEvent,
  WorksheetReadyEvent,
  HyperlinksEvent
} from "./stream/xlsx/workbook-reader";

export type {
  WorksheetReaderOptions,
  WorksheetEvent,
  RowEvent,
  HyperlinkEvent,
  WorksheetHyperlink
} from "./stream/xlsx/worksheet-reader";

// Node.js Only: Streaming writer types
export type {
  WorkbookWriterOptions,
  ZipOptions,
  ZlibOptions
} from "./stream/xlsx/workbook-writer";

// Node.js CSV types and stream classes (native implementation)
export type {
  CsvReadOptions,
  CsvWriteOptions,
  CsvStreamReadOptions,
  CsvStreamWriteOptions
} from "./csv/csv";
export { CsvParserStream, CsvFormatterStream } from "./csv/csv";

// =============================================================================
// Utilities
// =============================================================================

export * from "./utils/sheet-utils";
