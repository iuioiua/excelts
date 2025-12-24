/**
 * Browser-compatible Encryptor with pure JS SHA implementations
 * This provides synchronous hash functions for browser compatibility
 */

import {
  BrowserBuffer,
  base64ToUint8Array,
  uint8ArrayToBase64,
  stringToUtf16Le,
  concatUint8Arrays
} from "./browser-buffer";

// Helper to convert number to little-endian Uint8Array
function uint32ToLe(num: number): Uint8Array {
  const bytes = new Uint8Array(4);
  bytes[0] = num & 0xff;
  bytes[1] = (num >> 8) & 0xff;
  bytes[2] = (num >> 16) & 0xff;
  bytes[3] = (num >> 24) & 0xff;
  return bytes;
}

// ============================================================================
// Pure JavaScript SHA-512 implementation
// ============================================================================

// SHA-512 constants (first 80 primes 2..409)
const K = new BigUint64Array([
  0x428a2f98d728ae22n,
  0x7137449123ef65cdn,
  0xb5c0fbcfec4d3b2fn,
  0xe9b5dba58189dbb4n,
  0x3956c25bf348b538n,
  0x59f111f1b605d019n,
  0x923f82a4af194f9bn,
  0xab1c5ed5da6d8118n,
  0xd807aa98a3030242n,
  0x12835b0145706fben,
  0x243185be4ee4b28cn,
  0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn,
  0x80deb1fe3b1696b1n,
  0x9bdc06a725c71235n,
  0xc19bf174cf692694n,
  0xe49b69c19ef14ad2n,
  0xefbe4786384f25e3n,
  0x0fc19dc68b8cd5b5n,
  0x240ca1cc77ac9c65n,
  0x2de92c6f592b0275n,
  0x4a7484aa6ea6e483n,
  0x5cb0a9dcbd41fbd4n,
  0x76f988da831153b5n,
  0x983e5152ee66dfabn,
  0xa831c66d2db43210n,
  0xb00327c898fb213fn,
  0xbf597fc7beef0ee4n,
  0xc6e00bf33da88fc2n,
  0xd5a79147930aa725n,
  0x06ca6351e003826fn,
  0x142929670a0e6e70n,
  0x27b70a8546d22ffcn,
  0x2e1b21385c26c926n,
  0x4d2c6dfc5ac42aedn,
  0x53380d139d95b3dfn,
  0x650a73548baf63den,
  0x766a0abb3c77b2a8n,
  0x81c2c92e47edaee6n,
  0x92722c851482353bn,
  0xa2bfe8a14cf10364n,
  0xa81a664bbc423001n,
  0xc24b8b70d0f89791n,
  0xc76c51a30654be30n,
  0xd192e819d6ef5218n,
  0xd69906245565a910n,
  0xf40e35855771202an,
  0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n,
  0x1e376c085141ab53n,
  0x2748774cdf8eeb99n,
  0x34b0bcb5e19b48a8n,
  0x391c0cb3c5c95a63n,
  0x4ed8aa4ae3418acbn,
  0x5b9cca4f7763e373n,
  0x682e6ff3d6b2b8a3n,
  0x748f82ee5defb2fcn,
  0x78a5636f43172f60n,
  0x84c87814a1f0ab72n,
  0x8cc702081a6439ecn,
  0x90befffa23631e28n,
  0xa4506cebde82bde9n,
  0xbef9a3f7b2c67915n,
  0xc67178f2e372532bn,
  0xca273eceea26619cn,
  0xd186b8c721c0c207n,
  0xeada7dd6cde0eb1en,
  0xf57d4f7fee6ed178n,
  0x06f067aa72176fban,
  0x0a637dc5a2c898a6n,
  0x113f9804bef90daen,
  0x1b710b35131c471bn,
  0x28db77f523047d84n,
  0x32caab7b40c72493n,
  0x3c9ebe0a15c9bebcn,
  0x431d67c49c100d4cn,
  0x4cc5d4becb3e42b6n,
  0x597f299cfc657e2an,
  0x5fcb6fab3ad6faecn,
  0x6c44198c4a475817n
]);

// Initial hash values for SHA-512
const H0 = new BigUint64Array([
  0x6a09e667f3bcc908n,
  0xbb67ae8584caa73bn,
  0x3c6ef372fe94f82bn,
  0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n,
  0x9b05688c2b3e6c1fn,
  0x1f83d9abfb41bd6bn,
  0x5be0cd19137e2179n
]);

function rotr64(x: bigint, n: number): bigint {
  return ((x >> BigInt(n)) | (x << BigInt(64 - n))) & 0xffffffffffffffffn;
}

function sha512(message: Uint8Array): Uint8Array {
  // Pre-processing: adding padding bits
  const msgLen = message.length;
  const msgBitLen = BigInt(msgLen * 8);

  // Calculate padding length (message + 1 + padding + 16 bytes for length) should be multiple of 128
  const padLen = (128 - ((msgLen + 17) % 128)) % 128;
  const paddedLen = msgLen + 1 + padLen + 16;

  const padded = new Uint8Array(paddedLen);
  padded.set(message);
  padded[msgLen] = 0x80;

  // Append original length in bits as 128-bit big-endian (we only use lower 64 bits)
  const view = new DataView(padded.buffer);
  // Upper 64 bits (always 0 for messages < 2^64 bits)
  view.setBigUint64(paddedLen - 16, 0n, false);
  // Lower 64 bits
  view.setBigUint64(paddedLen - 8, msgBitLen, false);

  // Initialize hash values
  const H = new BigUint64Array(H0);

  // Process message in 1024-bit (128-byte) chunks
  const W = new BigUint64Array(80);

  for (let chunkStart = 0; chunkStart < paddedLen; chunkStart += 128) {
    const chunkView = new DataView(padded.buffer, chunkStart, 128);

    // Copy chunk into first 16 words W[0..15]
    for (let i = 0; i < 16; i++) {
      W[i] = chunkView.getBigUint64(i * 8, false);
    }

    // Extend the first 16 words into the remaining 64 words W[16..79]
    for (let i = 16; i < 80; i++) {
      const s0 = rotr64(W[i - 15], 1) ^ rotr64(W[i - 15], 8) ^ (W[i - 15] >> 7n);
      const s1 = rotr64(W[i - 2], 19) ^ rotr64(W[i - 2], 61) ^ (W[i - 2] >> 6n);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) & 0xffffffffffffffffn;
    }

    // Initialize working variables
    let a = H[0],
      b = H[1],
      c = H[2],
      d = H[3];
    let e = H[4],
      f = H[5],
      g = H[6],
      h = H[7];

    // Main loop
    for (let i = 0; i < 80; i++) {
      const S1 = rotr64(e, 14) ^ rotr64(e, 18) ^ rotr64(e, 41);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) & 0xffffffffffffffffn;
      const S0 = rotr64(a, 28) ^ rotr64(a, 34) ^ rotr64(a, 39);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & 0xffffffffffffffffn;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) & 0xffffffffffffffffn;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) & 0xffffffffffffffffn;
    }

    // Add compressed chunk to current hash value
    H[0] = (H[0] + a) & 0xffffffffffffffffn;
    H[1] = (H[1] + b) & 0xffffffffffffffffn;
    H[2] = (H[2] + c) & 0xffffffffffffffffn;
    H[3] = (H[3] + d) & 0xffffffffffffffffn;
    H[4] = (H[4] + e) & 0xffffffffffffffffn;
    H[5] = (H[5] + f) & 0xffffffffffffffffn;
    H[6] = (H[6] + g) & 0xffffffffffffffffn;
    H[7] = (H[7] + h) & 0xffffffffffffffffn;
  }

  // Produce the final hash value (big-endian)
  const result = new Uint8Array(64);
  const resultView = new DataView(result.buffer);
  for (let i = 0; i < 8; i++) {
    resultView.setBigUint64(i * 8, H[i], false);
  }

  return result;
}

// ============================================================================
// Encryptor implementation
// ============================================================================

const Encryptor = {
  /**
   * Calculate a hash of the concatenated buffers with the given algorithm.
   * @param algorithm - The hash algorithm.
   * @returns The hash as Uint8Array
   */
  hash(algorithm: string, ...buffers: Uint8Array[]): Uint8Array {
    const data = concatUint8Arrays(...buffers);
    const algo = algorithm.toLowerCase().replace("-", "");

    if (algo === "sha512") {
      return sha512(data);
    }

    throw new Error(`Hash algorithm '${algorithm}' not supported in browser sync mode!`);
  },

  /**
   * Convert a password into an encryption key
   * @param password - The password
   * @param hashAlgorithm - The hash algorithm
   * @param saltValue - The salt value (base64 encoded)
   * @param spinCount - The spin count
   * @returns The encryption key (base64 encoded)
   */
  convertPasswordToHash(
    password: string,
    hashAlgorithm: string,
    saltValue: string,
    spinCount: number
  ): string {
    const algo = hashAlgorithm.toLowerCase().replace("-", "");

    if (algo !== "sha512") {
      throw new Error(`Hash algorithm '${hashAlgorithm}' not supported in browser!`);
    }

    // Password must be in unicode buffer (UTF-16LE)
    const passwordBuffer = stringToUtf16Le(password);

    // Generate the initial hash
    const saltBuffer = base64ToUint8Array(saltValue);
    let key = this.hash(hashAlgorithm, saltBuffer, passwordBuffer);

    // Now regenerate until spin count
    for (let i = 0; i < spinCount; i++) {
      const iterator = uint32ToLe(i);
      key = this.hash(hashAlgorithm, key, iterator);
    }

    return uint8ArrayToBase64(key);
  },

  /**
   * Generates cryptographically strong pseudo-random data.
   * @param size The size argument is a number indicating the number of bytes to generate.
   */
  randomBytes(size: number): BrowserBuffer {
    const bytes = new BrowserBuffer(size);
    crypto.getRandomValues(bytes);
    return bytes;
  }
};

export { Encryptor };
