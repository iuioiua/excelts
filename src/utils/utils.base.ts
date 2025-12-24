/**
 * Base utility functions shared between Node.js and Browser
 * Platform-independent implementations only
 */

// =============================================================================
// Basic utilities
// =============================================================================

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function nop(): void {}

export const inherits = function <
  T extends new (...args: any[]) => any,
  S extends new (...args: any[]) => any
>(cls: T, superCtor: S, statics?: any, prototype?: any): void {
  (cls as any).super_ = superCtor;

  if (!prototype) {
    prototype = statics;
    statics = null;
  }

  if (statics) {
    Object.keys(statics).forEach(i => {
      Object.defineProperty(cls, i, Object.getOwnPropertyDescriptor(statics, i)!);
    });
  }

  const properties: PropertyDescriptorMap = {
    constructor: {
      value: cls,
      enumerable: false,
      writable: false,
      configurable: true
    }
  };
  if (prototype) {
    Object.keys(prototype).forEach(i => {
      properties[i] = Object.getOwnPropertyDescriptor(prototype, i)!;
    });
  }

  cls.prototype = Object.create(superCtor.prototype, properties);
};

// =============================================================================
// Date utilities
// =============================================================================

export function dateToExcel(d: Date, date1904?: boolean): number {
  return 25569 + d.getTime() / (24 * 3600 * 1000) - (date1904 ? 1462 : 0);
}

export function excelToDate(v: number, date1904?: boolean): Date {
  const millisecondSinceEpoch = Math.round((v - 25569 + (date1904 ? 1462 : 0)) * 24 * 3600 * 1000);
  return new Date(millisecondSinceEpoch);
}

export function toIsoDateString(dt: Date): string {
  return dt.toISOString().substr(0, 10);
}

// =============================================================================
// Path utilities
// =============================================================================

interface PathInfo {
  path: string;
  name: string;
}

export function parsePath(filepath: string): PathInfo {
  const last = filepath.lastIndexOf("/");
  return {
    path: filepath.substring(0, last),
    name: filepath.substring(last + 1)
  };
}

export function getRelsPath(filepath: string): string {
  const path = parsePath(filepath);
  return `${path.path}/_rels/${path.name}.rels`;
}

// =============================================================================
// XML utilities
// =============================================================================

const xmlDecodingMap: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'"
};

export function xmlDecode(text: string): string {
  return text.replace(/&(#\d+|#x[0-9A-Fa-f]+|\w+);/g, (match: string, entity: string) => {
    if (entity[0] === "#") {
      // Numeric character reference
      const code = entity[1] === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1));
      return String.fromCodePoint(code);
    }
    return xmlDecodingMap[entity] || match;
  });
}

// =============================================================================
// Parsing utilities
// =============================================================================

export function validInt(value: string | number): number {
  const i = typeof value === "number" ? value : parseInt(value, 10);
  return Number.isNaN(i) ? 0 : i;
}

export function isDateFmt(fmt: string | null | undefined): boolean {
  if (!fmt) {
    return false;
  }
  // must not be a string fmt
  if (fmt.indexOf("@") > -1) {
    return false;
  }
  // must remove all chars inside quotes and []
  let cleanFmt = fmt.replace(/\[[^\]]*]/g, "");
  cleanFmt = cleanFmt.replace(/"[^"]*"/g, "");
  // then check for date formatting chars
  return cleanFmt.match(/[ymdhMsb]+/) !== null;
}

export function parseBoolean(value: any): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

// =============================================================================
// Collection utilities
// =============================================================================

export function* range(start: number, stop: number, step: number = 1): Generator<number> {
  const compareOrder = step > 0 ? (a: number, b: number) => a < b : (a: number, b: number) => a > b;
  for (let value = start; compareOrder(value, stop); value += step) {
    yield value;
  }
}

export function toSortedArray(values: Iterable<any>): any[] {
  const result = Array.from(values);
  // If all numbers, use numeric sort
  if (result.every(item => Number.isFinite(item))) {
    return result.sort((a, b) => a - b);
  }
  return result.sort();
}

export function objectFromProps<T = any>(
  props: string[],
  value: T | null = null
): Record<string, T | null> {
  return props.reduce((result: Record<string, T | null>, property: string) => {
    result[property] = value;
    return result;
  }, {});
}

// =============================================================================
// Buffer utilities (cross-platform)
// =============================================================================

const textDecoder = new TextDecoder("utf-8");

/**
 * Convert a Buffer, ArrayBuffer, or Uint8Array to a UTF-8 string
 * Works in both Node.js and browser environments
 */
export function bufferToString(chunk: ArrayBuffer | Uint8Array | string): string {
  if (typeof chunk === "string") {
    return chunk;
  }
  return textDecoder.decode(chunk);
}
