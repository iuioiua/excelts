/**
 * CRC32 calculation utility for ZIP files (Browser version)
 *
 * Uses lookup table optimization - no Node.js dependencies
 *
 * The polynomial used is the standard CRC-32 IEEE 802.3:
 * x^32 + x^26 + x^23 + x^22 + x^16 + x^12 + x^11 + x^10 + x^8 + x^7 + x^5 + x^4 + x^2 + x + 1
 * Represented as 0xEDB88320 in reversed (LSB-first) form
 */

/**
 * Pre-computed CRC32 lookup table (256 entries)
 * Generated using the standard polynomial 0xEDB88320
 */
const CRC32_TABLE = /* @__PURE__ */ (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc;
  }
  return table;
})();

/**
 * Calculate CRC32 checksum for the given data
 *
 * @param data - Input data as Uint8Array
 * @returns CRC32 checksum as unsigned 32-bit integer
 *
 * @example
 * ```ts
 * const data = new TextEncoder().encode("Hello, World!");
 * const checksum = crc32(data);
 * console.log(checksum.toString(16)); // "ec4ac3d0"
 * ```
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Ensure CRC32 is ready (no-op in browser, for API compatibility)
 */
export async function ensureCrc32(): Promise<void> {
  // No-op in browser
}

/**
 * Calculate CRC32 incrementally (useful for streaming)
 * Call with initial crc of 0xffffffff, then finalize with crc32Finalize
 *
 * @param crc - Current CRC value (start with 0xffffffff)
 * @param data - Input data chunk
 * @returns Updated CRC value (not finalized)
 *
 * @example
 * ```ts
 * let crc = 0xffffffff;
 * crc = crc32Update(crc, chunk1);
 * crc = crc32Update(crc, chunk2);
 * const checksum = crc32Finalize(crc);
 * ```
 */
export function crc32Update(crc: number, data: Uint8Array): number {
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc;
}

/**
 * Finalize CRC32 calculation
 * XOR with 0xffffffff and convert to unsigned 32-bit
 *
 * @param crc - CRC value from crc32Update
 * @returns Final CRC32 checksum
 */
export function crc32Finalize(crc: number): number {
  return (crc ^ 0xffffffff) >>> 0;
}
