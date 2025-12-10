/**
 * ZIP file format builder
 *
 * Implements ZIP file structure according to PKWARE's APPNOTE.TXT specification
 * https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
 *
 * ZIP file structure:
 * ┌──────────────────────────┐
 * │   Local File Header 1    │
 * │   File Data 1            │
 * ├──────────────────────────┤
 * │   Local File Header 2    │
 * │   File Data 2            │
 * ├──────────────────────────┤
 * │         ...              │
 * ├──────────────────────────┤
 * │  Central Directory 1     │
 * │  Central Directory 2     │
 * │         ...              │
 * ├──────────────────────────┤
 * │ End of Central Directory │
 * └──────────────────────────┘
 */

import { crc32 } from "./crc32.js";
import { compress, compressSync, type CompressOptions } from "./compress.js";

/**
 * ZIP file entry
 */
export interface ZipEntry {
  /** File name (can include directory path, use forward slashes) */
  name: string;
  /** File data (will be compressed unless level=0) */
  data: Uint8Array;
  /** File modification time (optional, defaults to current time) */
  modTime?: Date;
  /** File comment (optional) */
  comment?: string;
}

/**
 * ZIP builder options
 */
export interface ZipOptions extends CompressOptions {
  /** ZIP file comment (optional) */
  comment?: string;
}

/**
 * Internal file entry with compression info
 */
interface ProcessedEntry {
  name: Uint8Array;
  data: Uint8Array;
  compressedData: Uint8Array;
  crc: number;
  compressionMethod: number;
  modTime: number;
  modDate: number;
  comment: Uint8Array;
  offset: number;
}

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

/**
 * Convert Date to DOS time format
 * @param date - Date to convert
 * @returns [dosTime, dosDate]
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
 * Encode string to UTF-8 bytes
 */
const encoder = new TextEncoder();
function encodeString(str: string): Uint8Array {
  return encoder.encode(str);
}

/**
 * Build Local File Header (30 bytes + filename + extra)
 */
function buildLocalFileHeader(entry: ProcessedEntry): Uint8Array {
  const header = new Uint8Array(30 + entry.name.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, LOCAL_FILE_HEADER_SIG, true); // Signature
  view.setUint16(4, VERSION_NEEDED, true); // Version needed to extract
  view.setUint16(6, 0x0800, true); // General purpose bit flag (UTF-8 names)
  view.setUint16(8, entry.compressionMethod, true); // Compression method
  view.setUint16(10, entry.modTime, true); // Last mod time
  view.setUint16(12, entry.modDate, true); // Last mod date
  view.setUint32(14, entry.crc, true); // CRC-32
  view.setUint32(18, entry.compressedData.length, true); // Compressed size
  view.setUint32(22, entry.data.length, true); // Uncompressed size
  view.setUint16(26, entry.name.length, true); // Filename length
  view.setUint16(28, 0, true); // Extra field length

  header.set(entry.name, 30);

  return header;
}

/**
 * Build Central Directory Header (46 bytes + filename + extra + comment)
 */
function buildCentralDirHeader(entry: ProcessedEntry): Uint8Array {
  const header = new Uint8Array(46 + entry.name.length + entry.comment.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, CENTRAL_DIR_HEADER_SIG, true); // Signature
  view.setUint16(4, VERSION_MADE_BY, true); // Version made by
  view.setUint16(6, VERSION_NEEDED, true); // Version needed to extract
  view.setUint16(8, 0x0800, true); // General purpose bit flag (UTF-8 names)
  view.setUint16(10, entry.compressionMethod, true); // Compression method
  view.setUint16(12, entry.modTime, true); // Last mod time
  view.setUint16(14, entry.modDate, true); // Last mod date
  view.setUint32(16, entry.crc, true); // CRC-32
  view.setUint32(20, entry.compressedData.length, true); // Compressed size
  view.setUint32(24, entry.data.length, true); // Uncompressed size
  view.setUint16(28, entry.name.length, true); // Filename length
  view.setUint16(30, 0, true); // Extra field length
  view.setUint16(32, entry.comment.length, true); // Comment length
  view.setUint16(34, 0, true); // Disk number start
  view.setUint16(36, 0, true); // Internal file attributes
  view.setUint32(38, 0, true); // External file attributes
  view.setUint32(42, entry.offset, true); // Relative offset of local header

  header.set(entry.name, 46);
  if (entry.comment.length > 0) {
    header.set(entry.comment, 46 + entry.name.length);
  }

  return header;
}

/**
 * Build End of Central Directory Record (22 bytes + comment)
 */
function buildEndOfCentralDir(
  entryCount: number,
  centralDirSize: number,
  centralDirOffset: number,
  comment: Uint8Array
): Uint8Array {
  const record = new Uint8Array(22 + comment.length);
  const view = new DataView(record.buffer);

  view.setUint32(0, END_OF_CENTRAL_DIR_SIG, true); // Signature
  view.setUint16(4, 0, true); // Number of this disk
  view.setUint16(6, 0, true); // Disk where central dir starts
  view.setUint16(8, entryCount, true); // Number of entries on this disk
  view.setUint16(10, entryCount, true); // Total number of entries
  view.setUint32(12, centralDirSize, true); // Size of central directory
  view.setUint32(16, centralDirOffset, true); // Offset of central directory
  view.setUint16(20, comment.length, true); // Comment length

  if (comment.length > 0) {
    record.set(comment, 22);
  }

  return record;
}

/**
 * Create a ZIP file from entries (async)
 *
 * @param entries - Files to include in ZIP
 * @param options - ZIP options
 * @returns ZIP file as Uint8Array
 *
 * @example
 * ```ts
 * const zip = await createZip([
 *   { name: "hello.txt", data: new TextEncoder().encode("Hello!") },
 *   { name: "folder/file.txt", data: new TextEncoder().encode("Nested!") }
 * ], { level: 6 });
 * ```
 */
export async function createZip(
  entries: ZipEntry[],
  options: ZipOptions = {}
): Promise<Uint8Array> {
  const level = options.level ?? 6;
  const zipComment = encodeString(options.comment ?? "");
  const now = new Date();

  // Process entries
  const processedEntries: ProcessedEntry[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const nameBytes = encodeString(entry.name);
    const commentBytes = encodeString(entry.comment ?? "");
    const modDate = entry.modTime ?? now;
    const [dosTime, dosDate] = dateToDos(modDate);

    // Compress data
    const isCompressed = level > 0 && entry.data.length > 0;
    const compressedData = isCompressed ? await compress(entry.data, { level }) : entry.data;

    const processedEntry: ProcessedEntry = {
      name: nameBytes,
      data: entry.data,
      compressedData,
      crc: crc32(entry.data),
      compressionMethod: isCompressed ? COMPRESSION_DEFLATE : COMPRESSION_STORE,
      modTime: dosTime,
      modDate: dosDate,
      comment: commentBytes,
      offset: currentOffset
    };

    // Calculate offset for next entry
    currentOffset += 30 + nameBytes.length + compressedData.length;

    processedEntries.push(processedEntry);
  }

  // Build ZIP structure
  const chunks: Uint8Array[] = [];

  // Local file headers and data
  for (const entry of processedEntries) {
    chunks.push(buildLocalFileHeader(entry));
    chunks.push(entry.compressedData);
  }

  const centralDirOffset = currentOffset;

  // Central directory
  const centralDirChunks: Uint8Array[] = [];
  for (const entry of processedEntries) {
    centralDirChunks.push(buildCentralDirHeader(entry));
  }
  chunks.push(...centralDirChunks);

  const centralDirSize = centralDirChunks.reduce((sum, c) => sum + c.length, 0);

  // End of central directory
  chunks.push(
    buildEndOfCentralDir(processedEntries.length, centralDirSize, centralDirOffset, zipComment)
  );

  // Combine all chunks
  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Create a ZIP file from entries (sync, Node.js only)
 *
 * @param entries - Files to include in ZIP
 * @param options - ZIP options
 * @returns ZIP file as Uint8Array
 * @throws Error if not in Node.js environment
 */
export function createZipSync(entries: ZipEntry[], options: ZipOptions = {}): Uint8Array {
  const level = options.level ?? 6;
  const zipComment = encodeString(options.comment ?? "");
  const now = new Date();

  // Process entries
  const processedEntries: ProcessedEntry[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const nameBytes = encodeString(entry.name);
    const commentBytes = encodeString(entry.comment ?? "");
    const modDate = entry.modTime ?? now;
    const [dosTime, dosDate] = dateToDos(modDate);

    // Compress data
    const isCompressed = level > 0 && entry.data.length > 0;
    const compressedData = isCompressed ? compressSync(entry.data, { level }) : entry.data;

    const processedEntry: ProcessedEntry = {
      name: nameBytes,
      data: entry.data,
      compressedData,
      crc: crc32(entry.data),
      compressionMethod: isCompressed ? COMPRESSION_DEFLATE : COMPRESSION_STORE,
      modTime: dosTime,
      modDate: dosDate,
      comment: commentBytes,
      offset: currentOffset
    };

    currentOffset += 30 + nameBytes.length + compressedData.length;

    processedEntries.push(processedEntry);
  }

  // Build ZIP structure
  const chunks: Uint8Array[] = [];

  // Local file headers and data
  for (const entry of processedEntries) {
    chunks.push(buildLocalFileHeader(entry));
    chunks.push(entry.compressedData);
  }

  const centralDirOffset = currentOffset;

  // Central directory
  const centralDirChunks: Uint8Array[] = [];
  for (const entry of processedEntries) {
    centralDirChunks.push(buildCentralDirHeader(entry));
  }
  chunks.push(...centralDirChunks);

  const centralDirSize = centralDirChunks.reduce((sum, c) => sum + c.length, 0);

  // End of central directory
  chunks.push(
    buildEndOfCentralDir(processedEntries.length, centralDirSize, centralDirOffset, zipComment)
  );

  // Combine all chunks
  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Streaming ZIP builder for large files
 * Writes chunks to a callback as they are generated
 */
export class ZipBuilder {
  private entries: ProcessedEntry[] = [];
  private currentOffset = 0;
  private level: number;
  private zipComment: Uint8Array;
  private finalized = false;

  /**
   * Create a new ZIP builder
   * @param options - ZIP options
   */
  constructor(options: ZipOptions = {}) {
    this.level = options.level ?? 6;
    this.zipComment = encodeString(options.comment ?? "");
  }

  /**
   * Add a file to the ZIP (async)
   * @param entry - File entry
   * @returns Local file header and compressed data chunks
   */
  async addFile(entry: ZipEntry): Promise<Uint8Array[]> {
    if (this.finalized) {
      throw new Error("Cannot add files after finalizing");
    }

    const nameBytes = encodeString(entry.name);
    const commentBytes = encodeString(entry.comment ?? "");
    const [dosTime, dosDate] = dateToDos(entry.modTime ?? new Date());

    // Compress data
    const isCompressed = this.level > 0 && entry.data.length > 0;
    const compressedData = isCompressed
      ? await compress(entry.data, { level: this.level })
      : entry.data;

    const processedEntry: ProcessedEntry = {
      name: nameBytes,
      data: entry.data,
      compressedData,
      crc: crc32(entry.data),
      compressionMethod: isCompressed ? COMPRESSION_DEFLATE : COMPRESSION_STORE,
      modTime: dosTime,
      modDate: dosDate,
      comment: commentBytes,
      offset: this.currentOffset
    };

    this.entries.push(processedEntry);
    this.currentOffset += 30 + nameBytes.length + compressedData.length;

    return [buildLocalFileHeader(processedEntry), compressedData];
  }

  /**
   * Add a file to the ZIP (sync, Node.js only)
   * @param entry - File entry
   * @returns Local file header and compressed data chunks
   */
  addFileSync(entry: ZipEntry): Uint8Array[] {
    if (this.finalized) {
      throw new Error("Cannot add files after finalizing");
    }

    const nameBytes = encodeString(entry.name);
    const commentBytes = encodeString(entry.comment ?? "");
    const [dosTime, dosDate] = dateToDos(entry.modTime ?? new Date());

    // Compress data
    const isCompressed = this.level > 0 && entry.data.length > 0;
    const compressedData = isCompressed
      ? compressSync(entry.data, { level: this.level })
      : entry.data;

    const processedEntry: ProcessedEntry = {
      name: nameBytes,
      data: entry.data,
      compressedData,
      crc: crc32(entry.data),
      compressionMethod: isCompressed ? COMPRESSION_DEFLATE : COMPRESSION_STORE,
      modTime: dosTime,
      modDate: dosDate,
      comment: commentBytes,
      offset: this.currentOffset
    };

    this.entries.push(processedEntry);
    this.currentOffset += 30 + nameBytes.length + compressedData.length;

    return [buildLocalFileHeader(processedEntry), compressedData];
  }

  /**
   * Finalize the ZIP and return central directory + end record
   * @returns Central directory and end of central directory chunks
   */
  finalize(): Uint8Array[] {
    if (this.finalized) {
      throw new Error("ZIP already finalized");
    }
    this.finalized = true;

    const chunks: Uint8Array[] = [];

    // Central directory
    for (const entry of this.entries) {
      chunks.push(buildCentralDirHeader(entry));
    }

    const centralDirSize = chunks.reduce((sum, c) => sum + c.length, 0);

    // End of central directory
    chunks.push(
      buildEndOfCentralDir(this.entries.length, centralDirSize, this.currentOffset, this.zipComment)
    );

    return chunks;
  }

  /**
   * Get current number of entries
   */
  get entryCount(): number {
    return this.entries.length;
  }

  /**
   * Get current ZIP data size (without central directory)
   */
  get dataSize(): number {
    return this.currentOffset;
  }
}
