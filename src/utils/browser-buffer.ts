/**
 * Browser-compatible Buffer utilities
 * Provides base64 encoding/decoding and a Buffer-like wrapper for Uint8Array
 */

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Buffer-like wrapper for Uint8Array with toString("base64") support
 * This provides Node.js Buffer-like API for browser environments
 */
export class BrowserBuffer extends Uint8Array {
  toString(encoding?: string): string {
    if (encoding === "base64") {
      return uint8ArrayToBase64(this);
    }
    return new TextDecoder().decode(this);
  }

  static from(data: Uint8Array): BrowserBuffer {
    const buffer = new BrowserBuffer(data.length);
    buffer.set(data);
    return buffer;
  }
}

/**
 * Convert string to UTF-16LE Uint8Array (used for Excel password hashing)
 */
export function stringToUtf16Le(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[i * 2] = code & 0xff;
    bytes[i * 2 + 1] = (code >> 8) & 0xff;
  }
  return bytes;
}

/**
 * Concatenate multiple Uint8Arrays into one
 */
export function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
