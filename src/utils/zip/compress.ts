/**
 * Node.js compression utilities using native zlib
 *
 * Uses zlib module (C++ implementation, fastest) with "deflate-raw" format
 * (raw DEFLATE without zlib header/trailer, required for ZIP files)
 */

import { deflateRawSync, inflateRawSync } from "zlib";

// Re-export shared types and utilities
export { type CompressOptions, hasCompressionStream } from "./compress.base";

/**
 * Check if native zlib is available (always true in Node.js)
 */
export function hasNativeZlib(): boolean {
  return true;
}

/**
 * Compress data using Node.js native zlib
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

  const result = deflateRawSync(Buffer.from(data), { level });
  return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
}

/**
 * Compress data synchronously using Node.js zlib
 *
 * @param data - Data to compress
 * @param options - Compression options
 * @returns Compressed data
 */
export function compressSync(data: Uint8Array, options: { level?: number } = {}): Uint8Array {
  const level = options.level ?? 6;

  if (level === 0) {
    return data;
  }

  const result = deflateRawSync(Buffer.from(data), { level });
  return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
}

/**
 * Decompress data using Node.js native zlib
 *
 * @param data - Compressed data (deflate-raw format)
 * @returns Decompressed data
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const result = inflateRawSync(Buffer.from(data));
  return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
}

/**
 * Decompress data synchronously using Node.js zlib
 *
 * @param data - Compressed data (deflate-raw format)
 * @returns Decompressed data
 */
export function decompressSync(data: Uint8Array): Uint8Array {
  const result = inflateRawSync(Buffer.from(data));
  return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
}
