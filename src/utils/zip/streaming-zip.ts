/**
 * Streaming ZIP creator - fflate-compatible API
 *
 * This module provides a streaming ZIP API compatible with fflate's Zip/ZipDeflate,
 * but uses native zlib compression for better performance.
 *
 * Usage:
 * ```ts
 * const zip = new StreamingZip((err, data, final) => {
 *   if (err) handleError(err);
 *   else {
 *     stream.write(data);
 *     if (final) stream.end();
 *   }
 * });
 *
 * const file = new ZipDeflateFile("path/file.txt", { level: 6 });
 * zip.add(file);
 * file.push(data1);
 * file.push(data2, true); // true = final chunk
 *
 * zip.end();
 * ```
 */

import { crc32 } from "./crc32";
import { compressSync } from "./compress";

// ZIP signature constants
const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;

// ZIP version constants
const VERSION_NEEDED = 20; // 2.0 - supports DEFLATE
const VERSION_MADE_BY = 20; // 2.0

// Compression methods
const COMPRESSION_STORE = 0;
const COMPRESSION_DEFLATE = 8;

const encoder = new TextEncoder();

/**
 * Convert Date to DOS time format
 */
function dateToDos(date: Date): [number, number] {
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);

  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);

  return [dosTime, dosDate];
}

/**
 * Internal entry info for central directory
 */
interface ZipEntryInfo {
  name: Uint8Array;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  dosTime: number;
  dosDate: number;
  offset: number;
}

/**
 * ZipDeflate-compatible file stream
 * Collects data chunks, compresses on finalization
 */
export class ZipDeflateFile {
  private chunks: Uint8Array[] = [];
  private totalSize = 0;
  private finalized = false;
  private _ondata: ((data: Uint8Array, final: boolean) => void) | null = null;

  readonly name: string;
  readonly level: number;

  constructor(name: string, options?: { level?: number }) {
    this.name = name;
    this.level = options?.level ?? 6;
  }

  /**
   * Set data callback (called by StreamingZip)
   */
  set ondata(cb: (data: Uint8Array, final: boolean) => void) {
    this._ondata = cb;
  }

  /**
   * Push data to the file
   * @param data - Data chunk
   * @param final - Whether this is the final chunk
   */
  push(data: Uint8Array, final = false): void {
    if (this.finalized) {
      throw new Error("Cannot push to finalized ZipDeflateFile");
    }

    if (data.length > 0) {
      this.chunks.push(data);
      this.totalSize += data.length;
    }

    if (final) {
      this.finalized = true;
      this._flush();
    }
  }

  /**
   * Flush collected data through compression and emit
   */
  private _flush(): void {
    if (!this._ondata) {
      return;
    }

    // Combine chunks
    let uncompressed: Uint8Array;
    if (this.chunks.length === 0) {
      uncompressed = new Uint8Array(0);
    } else if (this.chunks.length === 1) {
      uncompressed = this.chunks[0];
    } else {
      uncompressed = new Uint8Array(this.totalSize);
      let offset = 0;
      for (const chunk of this.chunks) {
        uncompressed.set(chunk, offset);
        offset += chunk.length;
      }
    }

    // Compress if level > 0 and data is not empty
    const shouldCompress = this.level > 0 && uncompressed.length > 0;
    const compressed = shouldCompress
      ? compressSync(uncompressed, { level: this.level })
      : uncompressed;

    // Build local file header + data
    const nameBytes = encoder.encode(this.name);
    const crcValue = crc32(uncompressed);
    const [dosTime, dosDate] = dateToDos(new Date());

    // Local file header (30 bytes + filename)
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);

    view.setUint32(0, LOCAL_FILE_HEADER_SIG, true);
    view.setUint16(4, VERSION_NEEDED, true);
    view.setUint16(6, 0x0800, true); // UTF-8 flag
    view.setUint16(8, shouldCompress ? COMPRESSION_DEFLATE : COMPRESSION_STORE, true);
    view.setUint16(10, dosTime, true);
    view.setUint16(12, dosDate, true);
    view.setUint32(14, crcValue, true);
    view.setUint32(18, compressed.length, true);
    view.setUint32(22, uncompressed.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true); // Extra field length

    header.set(nameBytes, 30);

    // Store info for central directory BEFORE emitting data
    // (StreamingZip reads this in the final callback)
    (this as any)._entryInfo = {
      name: nameBytes,
      crc: crcValue,
      compressedSize: compressed.length,
      uncompressedSize: uncompressed.length,
      compressionMethod: shouldCompress ? COMPRESSION_DEFLATE : COMPRESSION_STORE,
      dosTime,
      dosDate,
      offset: -1 // Will be set by StreamingZip
    };

    // Emit header
    this._ondata(header, false);

    // Emit compressed data (final chunk)
    this._ondata(compressed, true);

    // Clear chunks for GC
    this.chunks.length = 0;
  }

  /**
   * Get entry info (called by StreamingZip after finalization)
   */
  getEntryInfo(): ZipEntryInfo | null {
    return (this as any)._entryInfo || null;
  }
}

/**
 * Streaming ZIP - fflate Zip-compatible API
 * Creates ZIP files in a streaming manner
 */
export class StreamingZip {
  private callback: (err: Error | null, data: Uint8Array, final: boolean) => void;
  private entries: ZipEntryInfo[] = [];
  private currentOffset = 0;
  private ended = false;

  /**
   * Create a streaming ZIP
   * @param callback - Called with (err, data, final) as data becomes available
   */
  constructor(callback: (err: Error | null, data: Uint8Array, final: boolean) => void) {
    this.callback = callback;
  }

  /**
   * Add a file to the ZIP
   * @param file - ZipDeflateFile instance
   */
  add(file: ZipDeflateFile): void {
    if (this.ended) {
      throw new Error("Cannot add files after calling end()");
    }

    // Capture offset when first data is written, not when add() is called
    // This is important because streaming files may have data pushed later
    let startOffset = -1;

    file.ondata = (data: Uint8Array, final: boolean) => {
      // Capture offset on first data chunk
      if (startOffset === -1) {
        startOffset = this.currentOffset;
      }

      this.currentOffset += data.length;
      this.callback(null, data, false);

      if (final) {
        // Get entry info and set offset
        const entryInfo = file.getEntryInfo();
        if (entryInfo) {
          entryInfo.offset = startOffset;
          this.entries.push(entryInfo);
        }
      }
    };
  }

  /**
   * Finalize the ZIP
   * Writes central directory and end-of-central-directory record
   */
  end(): void {
    if (this.ended) {
      return;
    }
    this.ended = true;

    const centralDirOffset = this.currentOffset;
    const centralDirChunks: Uint8Array[] = [];

    // Build central directory headers
    for (const entry of this.entries) {
      const header = new Uint8Array(46 + entry.name.length);
      const view = new DataView(header.buffer);

      view.setUint32(0, CENTRAL_DIR_HEADER_SIG, true);
      view.setUint16(4, VERSION_MADE_BY, true);
      view.setUint16(6, VERSION_NEEDED, true);
      view.setUint16(8, 0x0800, true); // UTF-8 flag
      view.setUint16(10, entry.compressionMethod, true);
      view.setUint16(12, entry.dosTime, true);
      view.setUint16(14, entry.dosDate, true);
      view.setUint32(16, entry.crc, true);
      view.setUint32(20, entry.compressedSize, true);
      view.setUint32(24, entry.uncompressedSize, true);
      view.setUint16(28, entry.name.length, true);
      view.setUint16(30, 0, true); // Extra field length
      view.setUint16(32, 0, true); // Comment length
      view.setUint16(34, 0, true); // Disk number start
      view.setUint16(36, 0, true); // Internal file attributes
      view.setUint32(38, 0, true); // External file attributes
      view.setUint32(42, entry.offset, true);

      header.set(entry.name, 46);
      centralDirChunks.push(header);
    }

    // Emit central directory
    for (const chunk of centralDirChunks) {
      this.callback(null, chunk, false);
    }

    const centralDirSize = centralDirChunks.reduce((sum, c) => sum + c.length, 0);

    // Build end of central directory
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);

    eocdView.setUint32(0, END_OF_CENTRAL_DIR_SIG, true);
    eocdView.setUint16(4, 0, true); // Disk number
    eocdView.setUint16(6, 0, true); // Disk with central dir
    eocdView.setUint16(8, this.entries.length, true);
    eocdView.setUint16(10, this.entries.length, true);
    eocdView.setUint32(12, centralDirSize, true);
    eocdView.setUint32(16, centralDirOffset, true);
    eocdView.setUint16(20, 0, true); // Comment length

    // Emit end of central directory (final chunk)
    this.callback(null, eocd, true);
  }
}

// Export aliases for fflate compatibility
export { StreamingZip as Zip, ZipDeflateFile as ZipDeflate };
