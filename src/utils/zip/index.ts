/**
 * Native ZIP utilities - Pure native implementation without third-party dependencies
 *
 * This module provides ZIP file creation using only native platform APIs:
 * - Node.js: Uses native zlib module (C++ implementation, fastest)
 * - Browser: Uses CompressionStream API (Chrome 80+, Firefox 113+, Safari 16.4+)
 *
 * Features:
 * - Full ZIP format support (Local File Headers, Central Directory, EOCD)
 * - DEFLATE compression (level 0-9 on Node.js, fixed level on browser)
 * - STORE mode (no compression)
 * - UTF-8 filename support
 * - File comments and ZIP comments
 * - Streaming API for large files
 * - Both sync (Node.js) and async APIs
 *
 * @example Basic usage
 * ```ts
 * import { createZip } from "./utils/zip/index";
 *
 * const zipData = await createZip([
 *   { name: "hello.txt", data: new TextEncoder().encode("Hello!") },
 *   { name: "folder/nested.txt", data: new TextEncoder().encode("Nested file") }
 * ], { level: 6 });
 *
 * // Write to file (Node.js)
 * fs.writeFileSync("output.zip", zipData);
 * ```
 *
 * @example Streaming usage
 * ```ts
 * import { ZipBuilder } from "./utils/zip/index";
 *
 * const builder = new ZipBuilder({ level: 1 });
 *
 * // Add files one by one
 * const [header1, data1] = await builder.addFile({
 *   name: "file1.txt",
 *   data: new TextEncoder().encode("File 1 content")
 * });
 * stream.write(header1);
 * stream.write(data1);
 *
 * // Finalize and write central directory
 * for (const chunk of builder.finalize()) {
 *   stream.write(chunk);
 * }
 * ```
 */

// CRC32 utilities
export { crc32, crc32Update, crc32Finalize } from "./crc32";

// Compression utilities
export {
  compress,
  compressSync,
  decompress,
  decompressSync,
  hasNativeZlib,
  hasCompressionStream,
  type CompressOptions
} from "./compress";

// ZIP builder
export {
  createZip,
  createZipSync,
  ZipBuilder,
  type ZipEntry,
  type ZipOptions
} from "./zip-builder";
