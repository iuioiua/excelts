/**
 * Browser compression utilities using Web Streams API
 *
 * Uses CompressionStream API (Chrome 80+, Firefox 113+, Safari 16.4+)
 * with "deflate-raw" format (required for ZIP files)
 */

import {
  type CompressOptions,
  hasCompressionStream,
  compressWithStream,
  decompressWithStream
} from "./compress.base.js";

// Re-export shared types and utilities
export { type CompressOptions, hasCompressionStream };

/**
 * Check if native zlib is available (always false in browser)
 */
export function hasNativeZlib(): boolean {
  return false;
}

/**
 * Compress data using browser's native CompressionStream
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
  options: { level?: number } = {}
): Promise<Uint8Array> {
  const level = options.level ?? 6;

  // Level 0 means no compression
  if (level === 0) {
    return data;
  }

  // Use CompressionStream
  if (typeof CompressionStream !== "undefined") {
    return compressWithStream(data);
  }

  // No compression available - return original data
  console.warn("No native compression available, returning uncompressed data");
  return data;
}

/**
 * Compress data synchronously
 * Not available in browser - throws error
 *
 * @param _data - Data to compress
 * @param _options - Compression options
 * @throws Error always - sync compression not available in browser
 */
export function compressSync(_data: Uint8Array, _options: { level?: number } = {}): Uint8Array {
  throw new Error("Synchronous compression is not available in browser environment");
}

/**
 * Decompress data using browser's native DecompressionStream
 *
 * @param data - Compressed data (deflate-raw format)
 * @returns Decompressed data
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  // Use DecompressionStream
  if (typeof DecompressionStream !== "undefined") {
    return decompressWithStream(data);
  }

  throw new Error("No native decompression available in browser");
}

/**
 * Decompress data synchronously
 * Not available in browser - throws error
 *
 * @param _data - Compressed data
 * @throws Error always - sync decompression not available in browser
 */
export function decompressSync(_data: Uint8Array): Uint8Array {
  throw new Error("Synchronous decompression is not available in browser environment");
}
