/**
 * Unzip utilities for parsing ZIP archives
 *
 * Two APIs are provided:
 *
 * 1. **Stream-based API** (Node.js only):
 *    - `Parse`, `createParse` - Parse ZIP files as a stream
 *    - Best for large files where you don't want to load entire file into memory
 *    - Requires Node.js `stream` module
 *
 * 2. **Buffer-based API** (Browser + Node.js):
 *    - `extractAll`, `extractFile`, `listFiles`, `forEachEntry`, `ZipParser`
 *    - Works in both Node.js and browser environments
 *    - Uses native `DecompressionStream` in browser, `zlib` in Node.js
 *    - Best for files already loaded into memory (ArrayBuffer, Uint8Array)
 *
 * Original source: https://github.com/ZJONSSON/node-unzipper
 * License: MIT
 */

// Stream-based API (Node.js only - requires stream module)
export { Parse, createParse, type ParseOptions, type ZipEntry } from "./parse";
export { PullStream } from "./pull-stream";
export { NoopStream } from "./noop-stream";
export { bufferStream } from "./buffer-stream";
export { parse as parseBuffer } from "./parse-buffer";
export { parseDateTime } from "./parse-datetime";
export { parseExtraField, type ExtraField, type ZipVars } from "./parse-extra-field";

// Buffer-based API (Browser + Node.js - cross-platform)
export {
  extractAll,
  extractFile,
  listFiles,
  forEachEntry,
  ZipParser,
  type ExtractedFile,
  type ZipEntryInfo,
  type ZipParseOptions
} from "./extract";
