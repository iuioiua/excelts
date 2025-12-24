/**
 * Workbook - Node.js version with full functionality
 *
 * Extends WorkbookBase with:
 * - xlsx: Full file/stream/buffer support
 * - csv: CSV read/write support
 * - streaming: createStreamWriter/createStreamReader for large files
 */

import { WorkbookBase } from "./workbook.base";
import { XLSX } from "../xlsx/xlsx";
import { CSV } from "../csv/csv";
import { WorkbookWriter, type WorkbookWriterOptions } from "../stream/xlsx/workbook-writer";
import { WorkbookReader, type WorkbookReaderOptions } from "../stream/xlsx/workbook-reader";
import type { Readable } from "stream";

class Workbook extends WorkbookBase {
  /**
   * Streaming workbook writer class for large files.
   * @example new Workbook.Writer({ filename: "large.xlsx" })
   */
  static Writer = WorkbookWriter;

  /**
   * Streaming workbook reader class for large files.
   * @example new Workbook.Reader("large.xlsx")
   */
  static Reader = WorkbookReader;

  private _xlsx?: XLSX;
  private _csv?: CSV;

  /**
   * xlsx file format operations
   * Supports: readFile, writeFile, read (stream), write (stream), load (buffer), writeBuffer
   */
  get xlsx(): XLSX {
    if (!this._xlsx) {
      this._xlsx = new XLSX(this);
    }
    return this._xlsx;
  }

  /**
   * csv file format operations
   * Supports: readFile, writeFile, read (stream), write (stream)
   */
  get csv(): CSV {
    if (!this._csv) {
      this._csv = new CSV(this);
    }
    return this._csv;
  }

  // ===========================================================================
  // Static Factory Methods for Streaming (Node.js only)
  // ===========================================================================

  /**
   * Create a streaming workbook writer for large files.
   * This is more memory-efficient than using Workbook for large datasets.
   *
   * @param options - Options for the workbook writer
   * @returns A new WorkbookWriter instance
   *
   * @example
   * ```ts
   * const writer = Workbook.createStreamWriter({ filename: "large-file.xlsx" });
   * const sheet = writer.addWorksheet("Sheet1");
   * for (let i = 0; i < 1000000; i++) {
   *   sheet.addRow([i, `Row ${i}`]).commit();
   * }
   * await writer.commit();
   * ```
   */
  static createStreamWriter(options?: WorkbookWriterOptions): WorkbookWriter {
    return new WorkbookWriter(options);
  }

  /**
   * Create a streaming workbook reader for large files.
   * This is more memory-efficient than using Workbook.xlsx.readFile for large datasets.
   *
   * @param input - File path or readable stream
   * @param options - Options for the workbook reader
   * @returns A new WorkbookReader instance
   *
   * @example
   * ```ts
   * const reader = Workbook.createStreamReader("large-file.xlsx");
   * for await (const event of reader) {
   *   if (event.eventType === "worksheet") {
   *     const worksheet = event.value;
   *     for await (const row of worksheet) {
   *       console.log(row.values);
   *     }
   *   }
   * }
   * ```
   */
  static createStreamReader(
    input: string | Readable,
    options?: WorkbookReaderOptions
  ): WorkbookReader {
    return new WorkbookReader(input, options);
  }
}

export { Workbook };
