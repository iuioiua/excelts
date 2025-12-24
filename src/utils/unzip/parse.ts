/**
 * Unzipper parse module
 * Original source: https://github.com/ZJONSSON/node-unzipper
 * License: MIT
 * Copyright (c) 2012 - 2013 Near Infinity Corporation
 * Commits in this fork are (c) Ziggy Jonsson (ziggy.jonsson.nyc@gmail.com)
 */

import zlib from "zlib";
import { PassThrough, Transform, pipeline } from "stream";
import type { TransformCallback } from "stream";
import { PullStream } from "./pull-stream";
import { NoopStream } from "./noop-stream";
import { bufferStream } from "./buffer-stream";
import { parseExtraField, type ExtraField } from "./parse-extra-field";
import { parseDateTime } from "./parse-datetime";
import { parse as parseBuffer } from "./parse-buffer";

// Check if native zlib is available (Node.js environment)
// In browser with polyfill, createInflateRaw may not exist or may not work properly
const hasNativeZlib =
  typeof zlib?.createInflateRaw === "function" &&
  typeof process !== "undefined" &&
  process.versions?.node;

/**
 * A Transform stream that wraps browser's native DecompressionStream.
 * Used when native zlib is not available (browser environment).
 */
class BrowserInflateRawStream extends Transform {
  private chunks: Uint8Array[] = [];
  private totalLength = 0;

  constructor() {
    super();
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    // Avoid unnecessary copy - Buffer extends Uint8Array
    this.chunks.push(chunk);
    this.totalLength += chunk.length;
    callback();
  }

  _flush(callback: TransformCallback): void {
    try {
      // Use pre-calculated totalLength for better performance
      const combined = new Uint8Array(this.totalLength);
      let offset = 0;
      for (const chunk of this.chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      // Clear chunks to free memory
      this.chunks = [];

      // Use native DecompressionStream
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();

      // Optimized read loop - collect chunks and concatenate at the end
      const readAll = async (): Promise<Buffer> => {
        const results: Uint8Array[] = [];
        let total = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          results.push(value);
          total += value.length;
        }
        // Single allocation for final result
        const result = Buffer.allocUnsafe(total);
        let off = 0;
        for (const r of results) {
          result.set(r, off);
          off += r.length;
        }
        return result;
      };

      writer.write(combined);
      writer.close();

      readAll()
        .then(decompressed => {
          this.push(decompressed);
          callback();
        })
        .catch(callback);
    } catch (err) {
      callback(err as Error);
    }
  }
}

/**
 * Creates an InflateRaw stream.
 * Uses native zlib in Node.js for best performance, falls back to DecompressionStream in browser.
 */
function createInflateRaw(): Transform {
  if (hasNativeZlib) {
    return zlib.createInflateRaw();
  }
  return new BrowserInflateRawStream();
}

const endDirectorySignature = Buffer.alloc(4);
endDirectorySignature.writeUInt32LE(0x06054b50, 0);

export interface ParseOptions {
  verbose?: boolean;
  forceStream?: boolean;
}

export interface CrxHeader {
  version: number | null;
  pubKeyLength: number | null;
  signatureLength: number | null;
  publicKey?: Buffer;
  signature?: Buffer;
}

export interface EntryVars {
  versionsNeededToExtract: number | null;
  flags: number | null;
  compressionMethod: number | null;
  lastModifiedTime: number | null;
  lastModifiedDate: number | null;
  crc32: number | null;
  compressedSize: number;
  uncompressedSize: number;
  fileNameLength: number | null;
  extraFieldLength: number | null;
  lastModifiedDateTime?: Date;
  crxHeader?: CrxHeader;
}

export interface EntryProps {
  path: string;
  pathBuffer: Buffer;
  flags: {
    isUnicode: boolean;
  };
}

export interface ZipEntry extends PassThrough {
  path: string;
  props: EntryProps;
  type: "Directory" | "File";
  vars: EntryVars;
  extra: ExtraField;
  size?: number;
  __autodraining?: boolean;
  autodrain: () => NoopStream & { promise: () => Promise<void> };
  buffer: () => Promise<Buffer>;
}

export class Parse extends PullStream {
  private _opts: ParseOptions;
  crxHeader?: CrxHeader;
  reachedCD?: boolean;

  constructor(opts: ParseOptions = {}) {
    super();
    this._opts = opts;

    this.on("finish", () => {
      this.emit("end");
      this.emit("close");
    });

    this._readRecord().catch((e: Error) => {
      if (!this.__emittedError || this.__emittedError !== e) {
        this.emit("error", e);
      }
    });
  }

  private async _readRecord(): Promise<void> {
    const data = await this.pull(4);
    if (data.length === 0) {
      return;
    }

    const signature = data.readUInt32LE(0);

    if (signature === 0x34327243) {
      const shouldLoop = await this._readCrxHeader();
      if (shouldLoop) {
        return this._readRecord();
      }
      return;
    }
    if (signature === 0x04034b50) {
      const shouldLoop = await this._readFile();
      if (shouldLoop) {
        return this._readRecord();
      }
      return;
    } else if (signature === 0x02014b50) {
      this.reachedCD = true;
      const shouldLoop = await this._readCentralDirectoryFileHeader();
      if (shouldLoop) {
        return this._readRecord();
      }
      return;
    } else if (signature === 0x06054b50) {
      await this._readEndOfCentralDirectoryRecord();
      return;
    } else if (this.reachedCD) {
      // _readEndOfCentralDirectoryRecord expects the EOCD
      // signature to be consumed so set includeEof=true
      const includeEof = true;
      await this.pull(endDirectorySignature, includeEof);
      await this._readEndOfCentralDirectoryRecord();
      return;
    } else {
      this.emit("error", new Error("invalid signature: 0x" + signature.toString(16)));
    }
  }

  private async _readCrxHeader(): Promise<boolean> {
    const data = await this.pull(12);
    this.crxHeader = parseBuffer(data, [
      ["version", 4],
      ["pubKeyLength", 4],
      ["signatureLength", 4]
    ]) as unknown as CrxHeader;

    const keyAndSig = await this.pull(
      (this.crxHeader.pubKeyLength || 0) + (this.crxHeader.signatureLength || 0)
    );
    this.crxHeader.publicKey = keyAndSig.slice(0, this.crxHeader.pubKeyLength || 0);
    this.crxHeader.signature = keyAndSig.slice(this.crxHeader.pubKeyLength || 0);
    this.emit("crx-header", this.crxHeader);
    return true;
  }

  private async _readFile(): Promise<boolean> {
    const data = await this.pull(26);
    const vars = parseBuffer(data, [
      ["versionsNeededToExtract", 2],
      ["flags", 2],
      ["compressionMethod", 2],
      ["lastModifiedTime", 2],
      ["lastModifiedDate", 2],
      ["crc32", 4],
      ["compressedSize", 4],
      ["uncompressedSize", 4],
      ["fileNameLength", 2],
      ["extraFieldLength", 2]
    ]) as unknown as EntryVars;

    vars.lastModifiedDateTime = parseDateTime(
      vars.lastModifiedDate || 0,
      vars.lastModifiedTime || 0
    );

    if (this.crxHeader) {
      vars.crxHeader = this.crxHeader;
    }

    const fileNameBuffer = await this.pull(vars.fileNameLength || 0);
    const fileName = fileNameBuffer.toString("utf8");
    const entry = new PassThrough() as ZipEntry;
    let __autodraining = false;

    entry.autodrain = function () {
      __autodraining = true;
      const draining = entry.pipe(new NoopStream()) as NoopStream & {
        promise: () => Promise<void>;
      };
      draining.promise = function () {
        return new Promise<void>((resolve, reject) => {
          draining.on("finish", resolve);
          draining.on("error", reject);
        });
      };
      return draining;
    };

    entry.buffer = function () {
      return bufferStream(entry);
    };

    entry.path = fileName;
    entry.props = {
      path: fileName,
      pathBuffer: fileNameBuffer,
      flags: {
        isUnicode: ((vars.flags || 0) & 0x800) !== 0
      }
    };
    entry.type = vars.uncompressedSize === 0 && /[/\\]$/.test(fileName) ? "Directory" : "File";

    if (this._opts.verbose) {
      if (entry.type === "Directory") {
        console.log("   creating:", fileName);
      } else if (entry.type === "File") {
        if (vars.compressionMethod === 0) {
          console.log(" extracting:", fileName);
        } else {
          console.log("  inflating:", fileName);
        }
      }
    }

    const extraFieldData = await this.pull(vars.extraFieldLength || 0);
    const extra = parseExtraField(extraFieldData, vars);

    entry.vars = vars;
    entry.extra = extra;

    if (this._opts.forceStream) {
      this.push(entry);
    } else {
      this.emit("entry", entry);

      const state = (this as any)._readableState;
      if (state.pipesCount || (state.pipes && state.pipes.length)) {
        this.push(entry);
      }
    }

    if (this._opts.verbose) {
      console.log({
        filename: fileName,
        vars: vars,
        extra: extra
      });
    }

    const fileSizeKnown = !((vars.flags || 0) & 0x08) || vars.compressedSize > 0;
    let eof: number | Buffer;

    entry.__autodraining = __autodraining; // expose __autodraining for test purposes
    const inflater =
      vars.compressionMethod && !__autodraining ? createInflateRaw() : new PassThrough();

    if (fileSizeKnown) {
      entry.size = vars.uncompressedSize;
      eof = vars.compressedSize;
    } else {
      eof = Buffer.alloc(4);
      eof.writeUInt32LE(0x08074b50, 0);
    }

    return new Promise<boolean>((resolve, reject) => {
      pipeline(this.stream(eof), inflater, entry, err => {
        if (err) {
          return reject(err);
        }

        return fileSizeKnown
          ? resolve(fileSizeKnown)
          : this._processDataDescriptor(entry).then(resolve).catch(reject);
      });
    });
  }

  private async _processDataDescriptor(entry: ZipEntry): Promise<boolean> {
    const data = await this.pull(16);
    const vars = parseBuffer(data, [
      ["dataDescriptorSignature", 4],
      ["crc32", 4],
      ["compressedSize", 4],
      ["uncompressedSize", 4]
    ]);

    entry.size = vars.uncompressedSize || 0;
    return true;
  }

  private async _readCentralDirectoryFileHeader(): Promise<boolean> {
    const data = await this.pull(42);
    const vars = parseBuffer(data, [
      ["versionMadeBy", 2],
      ["versionsNeededToExtract", 2],
      ["flags", 2],
      ["compressionMethod", 2],
      ["lastModifiedTime", 2],
      ["lastModifiedDate", 2],
      ["crc32", 4],
      ["compressedSize", 4],
      ["uncompressedSize", 4],
      ["fileNameLength", 2],
      ["extraFieldLength", 2],
      ["fileCommentLength", 2],
      ["diskNumber", 2],
      ["internalFileAttributes", 2],
      ["externalFileAttributes", 4],
      ["offsetToLocalFileHeader", 4]
    ]);

    await this.pull(vars.fileNameLength || 0);
    await this.pull(vars.extraFieldLength || 0);
    await this.pull(vars.fileCommentLength || 0);

    return true;
  }

  private async _readEndOfCentralDirectoryRecord(): Promise<void> {
    const data = await this.pull(18);
    const vars = parseBuffer(data, [
      ["diskNumber", 2],
      ["diskStart", 2],
      ["numberOfRecordsOnDisk", 2],
      ["numberOfRecords", 2],
      ["sizeOfCentralDirectory", 4],
      ["offsetToStartOfCentralDirectory", 4],
      ["commentLength", 2]
    ]);

    await this.pull(vars.commentLength || 0);
    this.end();
    this.push(null);
  }

  promise(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.on("finish", resolve);
      this.on("error", reject);
    });
  }
}

export function createParse(opts?: ParseOptions): Parse {
  return new Parse(opts);
}
