/**
 * Native compression utilities using platform APIs
 *
 * - Node.js: Uses native zlib module (C++ implementation, fastest)
 * - Browser: Uses CompressionStream API (Chrome 80+, Firefox 113+, Safari 16.4+)
 *
 * Both use "deflate-raw" format which is required for ZIP files
 * (raw DEFLATE without zlib header/trailer)
 */

import type * as zlibType from "zlib";

/**
 * Compression options
 */
export interface CompressOptions {
  /**
   * Compression level (0-9)
   * - 0: No compression (STORE)
   * - 1: Fastest compression
   * - 6: Default compression (good balance)
   * - 9: Best compression (slowest)
   *
   * Note: CompressionStream does not support level configuration,
   * it uses a fixed level (~6)
   */
  level?: number;
}

// Detect environment
const isNode = typeof process !== "undefined" && process.versions?.node;

// Lazy-loaded zlib module for Node.js
let _zlib: typeof zlibType | null = null;
let _zlibLoading: Promise<typeof zlibType | null> | null = null;

// Auto-initialize zlib in Node.js environment
if (isNode) {
  _zlibLoading = import("zlib")
    .then(module => {
      _zlib = (module as { default?: typeof zlibType }).default ?? (module as typeof zlibType);
      return _zlib;
    })
    .catch(() => {
      _zlib = null;
      return null;
    });
}

/**
 * Get zlib module (Node.js only)
 * Returns null if not yet loaded or not in Node.js
 */
function getZlib(): typeof zlibType | null {
  return _zlib;
}

/**
 * Ensure zlib is loaded (Node.js only)
 * Call this before using sync methods if you need to guarantee availability
 */
export async function ensureZlib(): Promise<typeof zlibType | null> {
  if (_zlibLoading) {
    return _zlibLoading;
  }
  return _zlib;
}

/**
 * Check if native zlib is available (Node.js)
 */
export function hasNativeZlib(): boolean {
  const zlib = getZlib();
  return zlib !== null && typeof zlib.deflateRawSync === "function";
}

/**
 * Check if CompressionStream is available (Browser/Node.js 17+)
 */
export function hasCompressionStream(): boolean {
  return typeof CompressionStream !== "undefined";
}

/**
 * Compress data using the best available native method
 *
 * Priority:
 * 1. Node.js zlib (if available) - fastest, supports compression levels
 * 2. CompressionStream (browser/Node.js 17+) - no level support
 * 3. Return uncompressed data (fallback)
 *
 * @param data - Data to compress
 * @param options - Compression options
 * @returns Compressed data
 *
 * @example
 * ```ts
 * const data = new TextEncoder().encode("Hello, World!");
 * const compressed = await compress(data, { level: 6 });
 * ```
 */
export async function compress(
  data: Uint8Array,
  options: CompressOptions = {}
): Promise<Uint8Array> {
  const level = options.level ?? 6;

  // Level 0 means no compression
  if (level === 0) {
    return data;
  }

  // Ensure zlib is loaded first
  const zlib = await ensureZlib();

  // Try Node.js zlib first (fastest, supports levels)
  if (zlib && typeof zlib.deflateRawSync === "function") {
    const result = zlib.deflateRawSync(Buffer.from(data), { level });
    return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
  }

  // Fall back to CompressionStream (browser/Node.js 17+)
  if (typeof CompressionStream !== "undefined") {
    return compressWithCompressionStream(data);
  }

  // No compression available - return original data
  console.warn("No native compression available, returning uncompressed data");
  return data;
}

/**
 * Compress data synchronously using Node.js zlib
 * Only available in Node.js environment
 *
 * @param data - Data to compress
 * @param options - Compression options
 * @returns Compressed data
 * @throws Error if not in Node.js environment
 */
export function compressSync(data: Uint8Array, options: CompressOptions = {}): Uint8Array {
  const level = options.level ?? 6;

  if (level === 0) {
    return data;
  }

  const zlib = getZlib();
  if (!zlib || typeof zlib.deflateRawSync !== "function") {
    throw new Error("Synchronous compression is only available in Node.js environment");
  }

  const result = zlib.deflateRawSync(Buffer.from(data), { level });
  return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
}

/**
 * Compress using browser's native CompressionStream
 * Uses "deflate-raw" format (required for ZIP files)
 *
 * Note: CompressionStream does not support compression level configuration
 *
 * @param data - Data to compress
 * @returns Compressed data
 */
async function compressWithCompressionStream(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

  // Write data and close
  writer.write(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength) as unknown as BufferSource
  );
  writer.close();

  // Read all compressed chunks
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    totalLength += value.length;
  }

  // Combine chunks into single array
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Decompress data using the best available native method
 *
 * @param data - Compressed data (deflate-raw format)
 * @returns Decompressed data
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  // Ensure zlib is loaded first
  const zlib = await ensureZlib();

  // Try Node.js zlib first
  if (zlib && typeof zlib.inflateRawSync === "function") {
    const result = zlib.inflateRawSync(Buffer.from(data));
    return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
  }

  // Fall back to DecompressionStream
  if (typeof DecompressionStream !== "undefined") {
    return decompressWithDecompressionStream(data);
  }

  throw new Error("No native decompression available");
}

/**
 * Decompress data synchronously using Node.js zlib
 *
 * @param data - Compressed data (deflate-raw format)
 * @returns Decompressed data
 * @throws Error if not in Node.js environment
 */
export function decompressSync(data: Uint8Array): Uint8Array {
  const zlib = getZlib();
  if (!zlib || typeof zlib.inflateRawSync !== "function") {
    throw new Error("Synchronous decompression is only available in Node.js environment");
  }

  const result = zlib.inflateRawSync(Buffer.from(data));
  return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
}

/**
 * Decompress using browser's native DecompressionStream
 *
 * @param data - Compressed data (deflate-raw format)
 * @returns Decompressed data
 */
async function decompressWithDecompressionStream(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  // Write data and close
  writer.write(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength) as unknown as BufferSource
  );
  writer.close();

  // Read all decompressed chunks
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    totalLength += value.length;
  }

  // Combine chunks into single array
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}
