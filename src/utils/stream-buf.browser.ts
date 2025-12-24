import { StringBuf } from "./string-buf";

// =============================================================================
// Data chunks - encapsulating incoming data
class StringChunk {
  private _data: string;
  private _encoding: BufferEncoding;
  private _buffer?: Uint8Array;

  constructor(data: string, encoding: BufferEncoding) {
    this._data = data;
    this._encoding = encoding;
  }

  get length(): number {
    return this.toBuffer().length;
  }

  copy(target: Uint8Array, targetOffset: number, offset: number, length: number): number {
    const buf = this.toBuffer();
    const bytesToCopy = Math.min(length, buf.length - offset);
    target.set(buf.subarray(offset, offset + bytesToCopy), targetOffset);
    return bytesToCopy;
  }

  toBuffer(): Uint8Array {
    if (!this._buffer) {
      this._buffer = new TextEncoder().encode(this._data);
    }
    return this._buffer;
  }
}

class StringBufChunk {
  private _data: StringBuf;

  constructor(data: StringBuf) {
    this._data = data;
  }

  get length(): number {
    return this._data.length;
  }

  copy(target: Uint8Array, targetOffset: number, offset: number, length: number): number {
    const buf = this.toBuffer();
    const bytesToCopy = Math.min(length, buf.length - offset);
    target.set(buf.subarray(offset, offset + bytesToCopy), targetOffset);
    return bytesToCopy;
  }

  toBuffer(): Uint8Array {
    return this._data.toBuffer();
  }
}

class BufferChunk {
  private _data: Uint8Array;

  constructor(data: Uint8Array) {
    this._data = data;
  }

  get length(): number {
    return this._data.length;
  }

  copy(target: Uint8Array, targetOffset: number, offset: number, length: number): void {
    const bytesToCopy = Math.min(length, this._data.length - offset);
    target.set(this._data.subarray(offset, offset + bytesToCopy), targetOffset);
  }

  toBuffer(): Uint8Array {
    return this._data;
  }
}

type Chunk = StringChunk | StringBufChunk | BufferChunk;

// =============================================================================
// ReadWriteBuf - a single buffer supporting simple read-write
class ReadWriteBuf {
  size: number;
  buffer: Uint8Array;
  iRead: number;
  iWrite: number;

  constructor(size: number) {
    this.size = size;
    this.buffer = new Uint8Array(size);
    this.iRead = 0;
    this.iWrite = 0;
  }

  toBuffer(): Uint8Array {
    if (this.iRead === 0 && this.iWrite === this.size) {
      return this.buffer;
    }
    return this.buffer.slice(this.iRead, this.iWrite);
  }

  get length(): number {
    return this.iWrite - this.iRead;
  }

  get eod(): boolean {
    return this.iRead === this.iWrite;
  }

  get full(): boolean {
    return this.iWrite === this.size;
  }

  read(size?: number): Uint8Array | null {
    if (size === 0) {
      return null;
    }

    if (size === undefined || size >= this.length) {
      const buf = this.toBuffer();
      this.iRead = this.iWrite;
      return buf;
    }

    const buf = this.buffer.slice(this.iRead, this.iRead + size);
    this.iRead += size;
    return buf;
  }

  write(chunk: Chunk, offset: number, length: number): number {
    const size = Math.min(length, this.size - this.iWrite);
    chunk.copy(this.buffer, this.iWrite, offset, offset + size);
    this.iWrite += size;
    return size;
  }
}

interface StreamBufOptions {
  bufSize?: number;
  batch?: boolean;
}

type EventCallback = (...args: any[]) => void;

// =============================================================================
// StreamBuf - Browser version without Node.js stream dependency
// A simple buffer manager that mimics stream behavior for xlsx writing
class StreamBuf {
  private bufSize: number;
  private buffers: ReadWriteBuf[];
  private batch: boolean;
  private corked: boolean;
  private paused: boolean;
  private encoding: string | null;
  private pipes: any[];
  private events: Map<string, EventCallback[]>;

  constructor(options?: StreamBufOptions) {
    options = options || {};
    this.bufSize = options.bufSize || 1024 * 1024;
    this.buffers = [];
    this.batch = options.batch || false;
    this.corked = false;
    this.paused = false;
    this.encoding = null;
    this.pipes = [];
    this.events = new Map();
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

  toBuffer(): Uint8Array | null {
    switch (this.buffers.length) {
      case 0:
        return null;
      case 1:
        return this.buffers[0].toBuffer();
      default: {
        const totalLength = this.buffers.reduce((acc, buf) => acc + buf.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const rwBuf of this.buffers) {
          const buf = rwBuf.toBuffer();
          result.set(buf, offset);
          offset += buf.length;
        }
        return result;
      }
    }
  }

  private _getWritableBuffer(): ReadWriteBuf {
    if (this.buffers.length) {
      const last = this.buffers[this.buffers.length - 1];
      if (!last.full) {
        return last;
      }
    }
    const buf = new ReadWriteBuf(this.bufSize);
    this.buffers.push(buf);
    return buf;
  }

  private async _pipe(chunk: Chunk): Promise<void> {
    const write = (pipe: any): Promise<void> => {
      return new Promise(resolve => {
        pipe.write(chunk.toBuffer(), () => {
          resolve();
        });
      });
    };
    await Promise.all(this.pipes.map(write));
  }

  private _writeToBuffers(chunk: Chunk): void {
    let inPos = 0;
    const inLen = chunk.length;
    while (inPos < inLen) {
      const buffer = this._getWritableBuffer();
      inPos += buffer.write(chunk, inPos, inLen - inPos);
    }
  }

  async write(
    data: any,
    encoding?: BufferEncoding | Function,
    callback?: Function
  ): Promise<boolean> {
    const nop = () => {};
    if (encoding instanceof Function) {
      callback = encoding;
      encoding = "utf8";
    }
    callback = callback || nop;

    let chunk: Chunk;
    if (data instanceof StringBuf || (data && (data as any).constructor?.name === "StringBuf")) {
      chunk = new StringBufChunk(data as StringBuf);
    } else if (data instanceof Uint8Array) {
      chunk = new BufferChunk(data);
    } else if (ArrayBuffer.isView(data)) {
      chunk = new BufferChunk(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    } else if (data instanceof ArrayBuffer) {
      chunk = new BufferChunk(new Uint8Array(data));
    } else if (typeof data === "string" || data instanceof String) {
      chunk = new StringChunk(String(data), encoding as BufferEncoding);
    } else {
      throw new Error("Chunk must be one of type String, Uint8Array, ArrayBuffer or StringBuf.");
    }

    if (this.pipes.length) {
      if (this.batch) {
        this._writeToBuffers(chunk);
        while (!this.corked && this.buffers.length > 1) {
          await this._pipe(new BufferChunk(this.buffers.shift()!.toBuffer()));
        }
      } else if (!this.corked) {
        await this._pipe(chunk);
        callback();
      } else {
        this._writeToBuffers(chunk);
        queueMicrotask(() => callback!());
      }
    } else {
      if (!this.paused) {
        this.emit("data", chunk.toBuffer());
      }
      this._writeToBuffers(chunk);
      this.emit("readable");
    }

    return true;
  }

  cork(): void {
    this.corked = true;
  }

  private _flush(): void {
    if (this.pipes.length) {
      while (this.buffers.length) {
        this._pipe(new BufferChunk(this.buffers.shift()!.toBuffer()));
      }
    }
  }

  uncork(): void {
    this.corked = false;
    this._flush();
  }

  end(chunk?: any, encoding?: BufferEncoding, callback?: Function): void {
    const writeComplete = (error?: Error) => {
      if (error) {
        callback?.(error);
      } else {
        this._flush();
        this.pipes.forEach((pipe: any) => {
          pipe.end();
        });
        this.emit("finish");
      }
    };
    if (chunk) {
      this.write(chunk, encoding, writeComplete);
    } else {
      writeComplete();
    }
  }

  read(size?: number): Uint8Array {
    let buffers: Uint8Array[];
    if (size) {
      buffers = [];
      while (size && this.buffers.length && !this.buffers[0].eod) {
        const first = this.buffers[0];
        const buffer = first.read(size);
        if (buffer) {
          size -= buffer.length;
          buffers.push(buffer);
        }
        if (first.eod && first.full) {
          this.buffers.shift();
        }
      }
      return concatUint8Arrays(buffers);
    }

    buffers = this.buffers.map(buf => buf.toBuffer()).filter(Boolean) as Uint8Array[];
    this.buffers = [];
    return concatUint8Arrays(buffers);
  }

  setEncoding(encoding: string): void {
    this.encoding = encoding;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  isPaused(): boolean {
    return this.paused;
  }

  pipe(destination: any): any {
    this.pipes.push(destination);
    if (!this.paused && this.buffers.length) {
      this.end();
    }
    return destination;
  }

  unpipe(destination: any): void {
    this.pipes = this.pipes.filter((pipe: any) => pipe !== destination);
  }

  unshift(): void {
    throw new Error("Not Implemented");
  }

  wrap(): void {
    throw new Error("Not Implemented");
  }

  push(chunk: any): boolean {
    if (chunk !== null) {
      this.write(chunk);
    }
    return true;
  }
}

// Helper function to concatenate Uint8Arrays
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  if (arrays.length === 0) {
    return new Uint8Array(0);
  }
  if (arrays.length === 1) {
    return arrays[0];
  }

  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export { StreamBuf };
