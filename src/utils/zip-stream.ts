import events from "events";
import { ZipBuilder } from "./zip/index.js";
import { StreamBuf } from "./stream-buf.js";

interface ZipWriterOptions {
  /** Compression method: "DEFLATE" (default) or "STORE" (no compression) */
  compression?: "DEFLATE" | "STORE";
  compressionOptions?: {
    /** Compression level 0-9: 0=none, 1=fast (default), 9=best */
    level?: number;
  };
}

interface AppendOptions {
  name: string;
  base64?: boolean;
}

type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// =============================================================================
// The ZipWriter class
// Packs streamed data into an output zip stream
// Uses native zlib (Node.js) or CompressionStream (browser) for best performance
class ZipWriter extends events.EventEmitter {
  private stream: InstanceType<typeof StreamBuf>;
  private zipBuilder: ZipBuilder;
  private finalized = false;
  private pendingWrites: Promise<void>[] = [];

  constructor(options?: ZipWriterOptions) {
    super();

    // Determine compression level:
    // - STORE mode = 0 (no compression)
    // - DEFLATE mode = user level or default 1 (fast compression)
    const level =
      options?.compression === "STORE"
        ? 0
        : (Math.max(0, Math.min(9, options?.compressionOptions?.level ?? 1)) as CompressionLevel);

    this.stream = new StreamBuf();
    this.zipBuilder = new ZipBuilder({ level });
  }

  append(data: any, options: AppendOptions): void {
    let buffer: Uint8Array;

    if (Object.prototype.hasOwnProperty.call(options, "base64") && options.base64) {
      // Decode base64 data - Buffer.from works in both Node.js and browser (via polyfill)
      const base64Data = typeof data === "string" ? data : data.toString();
      buffer = Buffer.from(base64Data, "base64");
    } else if (typeof data === "string") {
      // Convert string to Buffer - works in both environments
      buffer = Buffer.from(data, "utf8");
    } else if (Buffer.isBuffer(data)) {
      // Buffer extends Uint8Array, can use it directly - no copy needed
      buffer = data;
    } else if (ArrayBuffer.isView(data)) {
      // Handle typed arrays - create view without copy
      buffer = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (data instanceof ArrayBuffer) {
      // Handle ArrayBuffer directly
      buffer = new Uint8Array(data);
    } else {
      // Assume it's already a Uint8Array or compatible type
      buffer = data;
    }

    // Add file to zip using native compression
    // addFile returns chunks that we write to stream immediately
    const writePromise = this.zipBuilder
      .addFile({ name: options.name, data: buffer })
      .then(chunks => {
        for (const chunk of chunks) {
          this.stream.write(Buffer.from(chunk));
        }
      });
    this.pendingWrites.push(writePromise);
  }

  push(chunk: any): boolean {
    return this.stream.push(chunk);
  }

  async finalize(): Promise<void> {
    if (this.finalized) {
      return;
    }
    this.finalized = true;

    // Wait for all pending writes to complete
    await Promise.all(this.pendingWrites);

    // Finalize the zip and write central directory
    const finalChunks = this.zipBuilder.finalize();
    for (const chunk of finalChunks) {
      this.stream.write(Buffer.from(chunk));
    }

    this.stream.end();
    this.emit("finish");
  }

  // ==========================================================================
  // Stream.Readable interface
  read(size?: number): any {
    return this.stream.read(size);
  }

  setEncoding(encoding: string): any {
    return this.stream.setEncoding(encoding);
  }

  pause(): any {
    return this.stream.pause();
  }

  resume(): any {
    return this.stream.resume();
  }

  isPaused(): boolean {
    return this.stream.isPaused();
  }

  pipe(destination: any, options?: any): any {
    return this.stream.pipe(destination, options);
  }

  unpipe(destination?: any): any {
    return this.stream.unpipe(destination);
  }

  unshift(chunk: any): any {
    return this.stream.unshift(chunk);
  }

  wrap(stream: any): any {
    return this.stream.wrap(stream);
  }
}

// =============================================================================

export { ZipWriter };
