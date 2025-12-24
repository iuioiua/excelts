/**
 * Native compression utilities using browser APIs
 *
 * Uses CompressionStream API (Chrome 80+, Firefox 113+, Safari 16.4+)
 * Uses "deflate-raw" format which is required for ZIP files
 * (raw DEFLATE without zlib header/trailer)
 */

/**
 * Compression options
 */
export interface CompressOptions {
  /**
   * Compression level (0-9)
   * - 0: No compression (STORE)
   * - 1-9: Compression levels
   *
   * Note: CompressionStream does not support level configuration,
   * it uses a fixed level (~6)
   */
  level?: number;
}

/**
 * Check if native zlib is available (always false in browser)
 */
export function hasNativeZlib(): boolean {
  return false;
}

/**
 * Check if CompressionStream is available
 */
export function hasCompressionStream(): boolean {
  return typeof CompressionStream !== "undefined";
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
  options: CompressOptions = {}
): Promise<Uint8Array> {
  const level = options.level ?? 6;

  // Level 0 means no compression
  if (level === 0) {
    return data;
  }

  // Use CompressionStream
  if (typeof CompressionStream !== "undefined") {
    return compressWithCompressionStream(data);
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
export function compressSync(_data: Uint8Array, _options: CompressOptions = {}): Uint8Array {
  throw new Error("Synchronous compression is not available in browser environment");
}

/**
 * Compress using browser's native CompressionStream
 * Uses "deflate-raw" format (required for ZIP files)
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
 * Decompress data using browser's native DecompressionStream
 *
 * @param data - Compressed data (deflate-raw format)
 * @returns Decompressed data
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  // Use DecompressionStream
  if (typeof DecompressionStream !== "undefined") {
    return decompressWithDecompressionStream(data);
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
