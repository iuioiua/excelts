/**
 * CSV class for Browser - No file system dependencies
 *
 * Provides:
 * - load: Load from string or ArrayBuffer
 * - writeString: Write to string
 * - writeBuffer: Write to Uint8Array
 */

import {
  parseCsvToWorksheet,
  formatWorksheetToCsv,
  type CsvReadOptions,
  type CsvWriteOptions
} from "./csv.base";
import type { Workbook } from "../doc/workbook.browser";
import type { Worksheet } from "../doc/worksheet";

class CSV {
  public workbook: Workbook;

  constructor(workbook: Workbook) {
    this.workbook = workbook;
  }

  /**
   * Load CSV from string or ArrayBuffer
   */
  load(data: string | ArrayBuffer | Uint8Array, options?: CsvReadOptions): Worksheet {
    let content: string;

    if (typeof data === "string") {
      content = data;
    } else if (data instanceof ArrayBuffer) {
      content = new TextDecoder("utf-8").decode(data);
    } else if (data instanceof Uint8Array) {
      content = new TextDecoder("utf-8").decode(data);
    } else {
      throw new Error("Invalid data type. Expected string, ArrayBuffer, or Uint8Array.");
    }

    return parseCsvToWorksheet(content, this.workbook as any, options);
  }

  /**
   * Write CSV to string
   */
  writeString(options?: CsvWriteOptions): string {
    const worksheet = this.workbook.getWorksheet(options?.sheetName || options?.sheetId);
    return formatWorksheetToCsv(worksheet, options);
  }

  /**
   * Write CSV to Uint8Array buffer
   */
  writeBuffer(options?: CsvWriteOptions): Uint8Array {
    const content = this.writeString(options);
    return new TextEncoder().encode(content);
  }

  // Stubs for unsupported methods - throw helpful errors
  async readFile(_filename: string, _options?: CsvReadOptions): Promise<never> {
    throw new Error(
      "CSV.readFile() is not available in browser. " +
        "Use CSV.load() with string or ArrayBuffer instead."
    );
  }

  async read(_stream: any, _options?: CsvReadOptions): Promise<never> {
    throw new Error(
      "CSV.read() stream is not available in browser. " +
        "Use CSV.load() with string or ArrayBuffer instead."
    );
  }

  async writeFile(_filename: string, _options?: CsvWriteOptions): Promise<never> {
    throw new Error(
      "CSV.writeFile() is not available in browser. " +
        "Use CSV.writeString() or CSV.writeBuffer() and handle download manually."
    );
  }

  write(_stream: any, _options?: CsvWriteOptions): Promise<never> {
    throw new Error(
      "CSV.write() stream is not available in browser. " +
        "Use CSV.writeString() or CSV.writeBuffer() instead."
    );
  }
}

export { CSV };
export type { CsvReadOptions, CsvWriteOptions } from "./csv.base";
