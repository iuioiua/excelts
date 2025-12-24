/**
 * XLSX - Node.js version with full functionality
 *
 * Extends XLSXBase with:
 * - readFile: Read from file path
 * - writeFile: Write to file path
 * - read: Read from stream
 * - write: Write to stream
 * - load: Load from buffer
 * - writeBuffer: Write to buffer
 */

import fs from "fs";
import type { UnzipFile } from "fflate";
import { Unzip, UnzipInflate } from "fflate";
import { PassThrough } from "stream";
import { ZipWriter } from "../utils/zip-stream.js";
import { StreamBuf } from "../utils/stream-buf.js";
import { fileExists, bufferToString } from "../utils/utils.js";
import { XLSXBase, type IStreamBuf, type IParseStream } from "./xlsx.base.js";

function fsReadFileAsync(filename: string, options?: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, options, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}

class XLSX extends XLSXBase {
  // ===========================================================================
  // Abstract method implementations
  // ===========================================================================

  protected createStreamBuf(): IStreamBuf {
    return new StreamBuf() as unknown as IStreamBuf;
  }

  protected createBinaryStream(data: Uint8Array): IParseStream {
    const stream = new PassThrough();
    stream.end(Buffer.from(data));
    return stream as unknown as IParseStream;
  }

  protected createTextStream(content: string): IParseStream {
    const stream = new PassThrough({
      readableObjectMode: true,
      writableObjectMode: true
    });
    stream.end(content);
    return stream as unknown as IParseStream;
  }

  protected bufferToString(data: any): string {
    return bufferToString(data);
  }

  // ===========================================================================
  // Node.js specific: File operations
  // ===========================================================================

  async readFile(filename: string, options?: any): Promise<any> {
    if (!(await fileExists(filename))) {
      throw new Error(`File not found: ${filename}`);
    }
    const stream = fs.createReadStream(filename);
    try {
      const workbook = await this.read(stream, options);
      stream.close();
      return workbook;
    } catch (error) {
      stream.close();
      throw error;
    }
  }

  writeFile(filename: string, options?: any): Promise<void> {
    const stream = fs.createWriteStream(filename);

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        stream.removeListener("finish", onFinish);
        stream.removeListener("error", onError);
      };

      const onFinish = () => {
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      stream.once("finish", onFinish);
      stream.on("error", onError);

      this.write(stream, options)
        .then(() => {
          stream.end();
        })
        .catch(err => {
          cleanup();
          reject(err);
        });
    });
  }

  // ===========================================================================
  // Node.js specific: Stream operations
  // ===========================================================================

  async read(stream: any, options?: any): Promise<any> {
    const allFiles: Record<string, Uint8Array> = {};

    await new Promise<void>((resolve, reject) => {
      let filesProcessed = 0;
      let zipEnded = false;
      let filesStarted = 0;

      const cleanup = () => {
        stream.removeListener("data", onData);
        stream.removeListener("end", onEnd);
        stream.removeListener("error", onError);
      };

      const checkCompletion = () => {
        if (zipEnded && filesProcessed === filesStarted) {
          cleanup();
          resolve();
        }
      };

      const unzipper = new Unzip((file: UnzipFile) => {
        filesStarted++;
        const fileChunks: Uint8Array[] = [];
        let totalLength = 0;

        file.ondata = (err, data, final) => {
          if (err) {
            cleanup();
            reject(err);
            return;
          }
          if (data) {
            fileChunks.push(data);
            totalLength += data.length;
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

      const onData = (chunk: Buffer) => {
        unzipper.push(chunk);
      };

      const onEnd = () => {
        unzipper.push(new Uint8Array(0), true);
        zipEnded = true;
        checkCompletion();
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      stream.on("data", onData);
      stream.on("end", onEnd);
      stream.on("error", onError);
    });

    return this.loadFromFiles(allFiles, options);
  }

  async write(stream: any, options?: any): Promise<XLSX> {
    options = options || {};
    const { model } = this.workbook;
    const zip = new ZipWriter(options.zip);
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
    return this._finalize(zip) as Promise<XLSX>;
  }

  // ===========================================================================
  // Node.js specific: Buffer operations
  // ===========================================================================

  async load(data: any, options?: any): Promise<any> {
    let buffer: Buffer;

    if (
      !data ||
      (typeof data === "object" &&
        !Buffer.isBuffer(data) &&
        !(data instanceof Uint8Array) &&
        !(data instanceof ArrayBuffer))
    ) {
      throw new Error(
        "Can't read the data of 'the loaded zip file'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"
      );
    }

    if (options && options.base64) {
      buffer = Buffer.from(data.toString(), "base64");
    } else {
      buffer = data;
    }

    const stream = new PassThrough();
    stream.end(buffer);

    return this.read(stream, options);
  }

  async writeBuffer(options?: any): Promise<Buffer> {
    const stream = new StreamBuf();
    await this.write(stream, options);
    return stream.read();
  }

  // ===========================================================================
  // Node.js specific: Media handling with file support
  // ===========================================================================

  async addMedia(zip: any, model: any): Promise<void> {
    await Promise.all(
      model.media.map(async (medium: any) => {
        if (medium.type === "image") {
          const filename = `xl/media/${medium.name}.${medium.extension}`;
          if (medium.filename) {
            const data = await fsReadFileAsync(medium.filename);
            return zip.append(data, { name: filename });
          }
          if (medium.buffer) {
            return zip.append(medium.buffer, { name: filename });
          }
          if (medium.base64) {
            const dataimg64 = medium.base64;
            const content = dataimg64.substring(dataimg64.indexOf(",") + 1);
            return zip.append(content, { name: filename, base64: true });
          }
        }
        throw new Error("Unsupported media");
      })
    );
  }
}

export { XLSX };
