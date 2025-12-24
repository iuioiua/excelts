/**
 * Workbook Browser version - No Node.js dependencies
 *
 * Extends WorkbookBase with:
 * - xlsx: Buffer-based operations (load, writeBuffer)
 * - csv: Buffer-based operations (load, writeString, writeBuffer)
 * - streaming: NOT supported (throws error)
 */

import { WorkbookBase } from "./workbook.base";
import { XLSX } from "../xlsx/xlsx.browser";
import { CSV } from "../csv/csv.browser";

class Workbook extends WorkbookBase {
  private _xlsx?: XLSX;
  private _csv?: CSV;

  /**
   * xlsx file format operations
   * Supports: load (buffer), writeBuffer
   * NOT supported: readFile, writeFile, read (stream), write (stream)
   */
  get xlsx(): XLSX {
    if (!this._xlsx) {
      this._xlsx = new XLSX(this);
    }
    return this._xlsx;
  }

  /**
   * CSV file format operations
   * Supports: load (string/buffer), writeString, writeBuffer
   * NOT supported: readFile, writeFile, read (stream), write (stream)
   */
  get csv(): CSV {
    if (!this._csv) {
      this._csv = new CSV(this as any);
    }
    return this._csv;
  }

  // ===========================================================================
  // Static Factory Methods - NOT available in browser
  // TypeScript users: These methods don't exist on this type
  // JavaScript users: These methods throw helpful errors
  // ===========================================================================

  /**
   * @deprecated Streaming is not available in browser
   * @throws Error with helpful message
   */
  static createStreamWriter(_options?: unknown): never {
    throw new Error(
      "Streaming workbook writer is not available in browser. " +
        "Use `new Workbook()` with `xlsx.writeBuffer()` instead, " +
        "or import from 'excelts' (Node.js) for streaming support."
    );
  }

  /**
   * @deprecated Streaming is not available in browser
   * @throws Error with helpful message
   */
  static createStreamReader(_input?: unknown, _options?: unknown): never {
    throw new Error(
      "Streaming workbook reader is not available in browser. " +
        "Use `new Workbook()` with `xlsx.load()` instead, " +
        "or import from 'excelts' (Node.js) for streaming support."
    );
  }
}

export { Workbook };
