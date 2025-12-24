import { ZipBuilder } from "./zip/zip-builder.js";
import { StreamBuf } from "./stream-buf.browser.js";

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
type EventCallback = (...args: any[]) => void;

// Helper function for base64 decoding in browser
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// =============================================================================
// The ZipWriter class - Browser version without Node.js events dependency
// Packs streamed data into an output zip stream
class ZipWriter {
  private stream: StreamBuf;
  private zipBuilder: ZipBuilder;
  private finalized = false;
  private pendingWrites: Promise<void>[] = [];
  private events: Map<string, EventCallback[]> = new Map();

  constructor(options?: ZipWriterOptions) {
    const level =
      options?.compression === "STORE"
        ? 0
        : (Math.max(0, Math.min(9, options?.compressionOptions?.level ?? 1)) as CompressionLevel);

    this.stream = new StreamBuf();
    this.zipBuilder = new ZipBuilder({ level });
  }

  // Event emitter methods
  on(event: string, callback: EventCallback): this {
    const callbacks = this.events.get(event) || [];
    callbacks.push(callback);
    this.events.set(event, callbacks);
    return this;
  }

  once(event: string, callback: EventCallback): this {
    const onceCallback = (...args: any[]) => {
      this.off(event, onceCallback);
      callback(...args);
    };
    return this.on(event, onceCallback);
  }

  off(event: string, callback: EventCallback): this {
    const callbacks = this.events.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const callbacks = this.events.get(event) || [];
    callbacks.forEach(cb => cb(...args));
    return callbacks.length > 0;
  }

  removeListener(event: string, callback: EventCallback): this {
    return this.off(event, callback);
  }

  append(data: any, options: AppendOptions): void {
    let buffer: Uint8Array;

    if (Object.prototype.hasOwnProperty.call(options, "base64") && options.base64) {
      const base64Data = typeof data === "string" ? data : String(data);
      buffer = base64ToUint8Array(base64Data);
    } else if (typeof data === "string") {
      buffer = new TextEncoder().encode(data);
    } else if (data instanceof Uint8Array) {
      buffer = data;
    } else if (ArrayBuffer.isView(data)) {
      buffer = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (data instanceof ArrayBuffer) {
      buffer = new Uint8Array(data);
    } else {
      buffer = data;
    }

    const writePromise = this.zipBuilder
      .addFile({ name: options.name, data: buffer })
      .then(chunks => {
        for (const chunk of chunks) {
          this.stream.write(new Uint8Array(chunk));
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

    await Promise.all(this.pendingWrites);

    const finalChunks = this.zipBuilder.finalize();
    for (const chunk of finalChunks) {
      this.stream.write(new Uint8Array(chunk));
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

  pipe(destination: any): any {
    return this.stream.pipe(destination);
  }

  unpipe(destination?: any): void {
    return this.stream.unpipe(destination);
  }

  unshift(): void {
    return this.stream.unshift();
  }

  wrap(): void {
    return this.stream.wrap();
  }
}

export { ZipWriter };
