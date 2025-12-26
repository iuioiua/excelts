/**
 * Base compression utilities using Web Streams API
 * Shared between Node.js and Browser implementations
 *
 * Uses CompressionStream/DecompressionStream API with "deflate-raw" format
 * (raw DEFLATE without zlib header/trailer, required for ZIP files)
 *
 * Browser fallback: For browsers without deflate-raw support (Firefox < 113, Safari < 16.4),
 * see deflate-fallback.ts for pure JS implementation
 */

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

/**
 * Check if CompressionStream is available
 */
export function hasCompressionStream(): boolean {
  return typeof CompressionStream !== "undefined";
}

/**
 * Compress using CompressionStream API
 * Uses "deflate-raw" format (required for ZIP files)
 *
 * @param data - Data to compress
 * @returns Compressed data
 */
export async function compressWithStream(data: Uint8Array): Promise<Uint8Array> {
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
 * Decompress using DecompressionStream API
 *
 * @param data - Compressed data (deflate-raw format)
 * @returns Decompressed data
 */
export async function decompressWithStream(data: Uint8Array): Promise<Uint8Array> {
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
