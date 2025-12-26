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

import { ZipParser } from "../utils/unzip/zip-parser";
import { ZipWriter } from "../utils/zip-stream.browser";
import { StreamBuf } from "../utils/stream-buf.browser";
import { bufferToString } from "../utils/utils";
import { base64ToUint8Array, BrowserBuffer } from "../utils/browser-buffer";
import { XLSXBase, type IStreamBuf, type IParseStream } from "./xlsx.base";

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

    // Use native ZipParser for extraction
    const parser = new ZipParser(buffer);
    const allFiles = await parser.extractAll();

    // Convert Map to Record for loadFromFiles
    const filesRecord: Record<string, Uint8Array> = {};
    for (const [path, content] of allFiles) {
      filesRecord[path] = content;
    }

    return this.loadFromFiles(filesRecord, options);
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
