/**
 * XLSX Browser version - No Node.js dependencies
 *
 * Extends XLSXBase with:
 * - load: Load from buffer/ArrayBuffer/Uint8Array
 * - writeBuffer: Write to BrowserBuffer (Uint8Array with toString("base64"))
 *
 * NOT supported:
 * - readFile/writeFile (no file system)
 * - read/write (no streams)
 */

import type { UnzipFile } from "fflate";
import { Unzip, UnzipInflate } from "fflate";
import { ZipWriter } from "../utils/zip-stream.browser.js";
import { StreamBuf } from "../utils/stream-buf.browser.js";
import { bufferToString } from "../utils/utils.js";
import { base64ToUint8Array, BrowserBuffer } from "../utils/browser-buffer.js";
import { XLSXBase, type IStreamBuf, type IParseStream } from "./xlsx.base.js";

/**
 * Simple stream-like wrapper for parsing - implements async iterable
 */
class SimpleStream implements IParseStream {
  private data: string | Uint8Array;
  private listeners: Map<string, Function[]> = new Map();
  private ended = false;

  constructor(data: string | Uint8Array) {
    this.data = data;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array | string> {
    yield this.data;
  }

  on(event: string, callback: Function): this {
    const listeners = this.listeners.get(event) || [];
    listeners.push(callback);
    this.listeners.set(event, listeners);

    if (!this.ended) {
      this.ended = true;
      queueMicrotask(() => {
        this.emit("data", this.data);
        this.emit("end");
      });
    }
    return this;
  }

  removeListener(event: string, callback: Function): this {
    const listeners = this.listeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    return this;
  }

  private emit(event: string, ...args: any[]): void {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(cb => cb(...args));
  }

  pipe(dest: IStreamBuf): IStreamBuf {
    dest.write(this.data instanceof Uint8Array ? this.data : new TextEncoder().encode(this.data));
    dest.end();
    return dest;
  }
}

class XLSX extends XLSXBase {
  // ===========================================================================
  // Abstract method implementations
  // ===========================================================================

  protected createStreamBuf(): IStreamBuf {
    return new StreamBuf() as unknown as IStreamBuf;
  }

  protected createBinaryStream(data: Uint8Array): IParseStream {
    return new SimpleStream(data);
  }

  protected createTextStream(content: string): IParseStream {
    return new SimpleStream(content);
  }

  protected bufferToString(data: any): string {
    return bufferToString(data);
  }

  // ===========================================================================
  // Browser specific: Buffer operations
  // ===========================================================================

  /**
   * Load workbook from buffer/ArrayBuffer/Uint8Array
   * This is the main entry point for browser usage
   */
  async load(data: any, options?: any): Promise<any> {
    let buffer: Uint8Array;

    if (
      !data ||
      (typeof data === "object" && !(data instanceof Uint8Array) && !(data instanceof ArrayBuffer))
    ) {
      throw new Error(
        "Can't read the data of 'the loaded zip file'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"
      );
    }

    if (options && options.base64) {
      buffer = base64ToUint8Array(data.toString());
    } else if (data instanceof ArrayBuffer) {
      buffer = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      buffer = data;
    } else {
      buffer = new Uint8Array(data);
    }

    const allFiles: Record<string, Uint8Array> = {};

    await new Promise<void>((resolve, reject) => {
      let filesProcessed = 0;
      let zipEnded = false;
      let filesStarted = 0;

      const checkCompletion = () => {
        if (zipEnded && filesProcessed === filesStarted) {
          resolve();
        }
      };

      const unzipper = new Unzip((file: UnzipFile) => {
        filesStarted++;
        const fileChunks: Uint8Array[] = [];
        let totalLength = 0;

        file.ondata = (err, fileData, final) => {
          if (err) {
            reject(err);
            return;
          }
          if (fileData) {
            fileChunks.push(fileData);
            totalLength += fileData.length;
          }
          if (final) {
            if (fileChunks.length === 1) {
              allFiles[file.name] = fileChunks[0];
            } else if (fileChunks.length > 1) {
              const fullData = new Uint8Array(totalLength);
              let offset = 0;
              for (const chunk of fileChunks) {
                fullData.set(chunk, offset);
                offset += chunk.length;
              }
              allFiles[file.name] = fullData;
            } else {
              allFiles[file.name] = new Uint8Array(0);
            }
            filesProcessed++;
            fileChunks.length = 0;
            checkCompletion();
          }
        };
        file.start();
      });

      unzipper.register(UnzipInflate);
      unzipper.push(buffer, true);
      zipEnded = true;
      checkCompletion();
    });

    return this.loadFromFiles(allFiles, options);
  }

  /**
   * Write workbook to buffer
   * Returns a BrowserBuffer which supports toString("base64")
   */
  async writeBuffer(options?: any): Promise<BrowserBuffer> {
    options = options || {};
    const { model } = this.workbook;
    const zip = new ZipWriter(options.zip);
    const stream = new StreamBuf();
    zip.pipe(stream);

    this.prepareModel(model, options);

    await this.addContentTypes(zip, model);
    await this.addOfficeRels(zip, model);
    await this.addWorkbookRels(zip, model);
    await this.addWorksheets(zip, model);
    await this.addSharedStrings(zip, model);
    this.addDrawings(zip, model);
    this.addTables(zip, model);
    this.addPivotTables(zip, model);
    await Promise.all([this.addThemes(zip, model), this.addStyles(zip, model)]);
    await this.addMedia(zip, model);
    await Promise.all([this.addApp(zip, model), this.addCore(zip, model)]);
    await this.addWorkbook(zip, model);

    await this._finalize(zip);
    return BrowserBuffer.from(stream.read());
  }

  // ===========================================================================
  // Browser specific: Media handling (no file support)
  // ===========================================================================

  async addMedia(zip: any, model: any): Promise<void> {
    await Promise.all(
      model.media.map(async (medium: any) => {
        if (medium.type === "image") {
          const filename = `xl/media/${medium.name}.${medium.extension}`;
          if (medium.buffer) {
            return zip.append(medium.buffer, { name: filename });
          }
          if (medium.base64) {
            const dataimg64 = medium.base64;
            const content = dataimg64.substring(dataimg64.indexOf(",") + 1);
            return zip.append(content, { name: filename, base64: true });
          }
          throw new Error("Loading images from filename is not supported in browser");
        }
        throw new Error("Unsupported media");
      })
    );
  }
}

export { XLSX };
