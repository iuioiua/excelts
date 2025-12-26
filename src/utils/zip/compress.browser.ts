/**
 * Browser compression utilities
 *
 * Primary: CompressionStream API (Chrome 103+, Firefox 113+, Safari 16.4+)
 * Fallback: Pure JS DEFLATE implementation for older browsers
 *
 * Supported browsers with fallback:
 * - Chrome >= 85
 * - Firefox >= 79
 * - Safari >= 14
 * - Edge >= 85
 */

import { type CompressOptions, compressWithStream, decompressWithStream } from "./compress.base";
import { inflateRaw, deflateRawCompressed, deflateRawStore } from "./deflate-fallback";

// Re-export shared types
export { type CompressOptions };

/**
 * Check if CompressionStream with "deflate-raw" is available
 * Note: Chrome 80-102 has CompressionStream but not deflate-raw support
 */
export function hasCompressionStream(): boolean {
  if (typeof CompressionStream === "undefined") {
    return false;
  }
  // Test if deflate-raw is supported (not just CompressionStream existence)
  try {
    new CompressionStream("deflate-raw");
    return true;
  } catch {
    return false;
  }
}

// Cache the detection result for performance
let _hasDeflateRaw: boolean | null = null;

/**
 * Check if deflate-raw is supported, with caching for performance.
 * The cache is bypassed if CompressionStream is undefined (for testing).
 */
function hasDeflateRawSupport(): boolean {
  // If API doesn't exist, return false immediately (bypass cache for tests)
  if (typeof CompressionStream === "undefined") {
    return false;
  }

  // Use cached result for performance
  if (_hasDeflateRaw === null) {
    _hasDeflateRaw = hasCompressionStream();
  }
  return _hasDeflateRaw;
}

/**
 * Check if native zlib is available (always false in browser)
 */
export function hasNativeZlib(): boolean {
  return false;
}

/**
 * Compress data using browser's native CompressionStream or JS fallback
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

  // Level 0 means no compression (STORE mode)
  if (level === 0) {
    return deflateRawStore(data);
  }

  // Use native CompressionStream if available
  if (hasDeflateRawSupport()) {
    return compressWithStream(data);
  }

  // Fallback to pure JS implementation
  return deflateRawCompressed(data);
}

/**
 * Compress data synchronously using pure JS implementation
 *
 * @param data - Data to compress
 * @param options - Compression options
 * @returns Compressed data
 */
export function compressSync(data: Uint8Array, options: { level?: number } = {}): Uint8Array {
  const level = options.level ?? 6;

  // Level 0 means no compression (STORE mode)
  if (level === 0) {
    return deflateRawStore(data);
  }

  // Pure JS implementation
  return deflateRawCompressed(data);
}

/**
 * Decompress data using browser's native DecompressionStream or JS fallback
 *
 * @param data - Compressed data (deflate-raw format)
 * @returns Decompressed data
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  // Use native DecompressionStream if available
  if (hasDeflateRawSupport()) {
    return decompressWithStream(data);
  }

  // Fallback to pure JS implementation
  return inflateRaw(data);
}

/**
 * Decompress data synchronously using pure JS implementation
 *
 * @param data - Compressed data (deflate-raw format)
 * @returns Decompressed data
 */
export function decompressSync(data: Uint8Array): Uint8Array {
  return inflateRaw(data);
}
