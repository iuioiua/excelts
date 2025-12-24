/**
 * Browser-compatible utility functions
 * This file contains utility functions that don't depend on Node.js modules
 */

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function nop(): void {}

// useful stuff
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

interface PathInfo {
  path: string;
  name: string;
}

export function dateToExcel(d: Date, date1904?: boolean): number {
  return 25569 + d.getTime() / (24 * 3600 * 1000) - (date1904 ? 1462 : 0);
}

export function excelToDate(v: number, date1904?: boolean): Date {
  const millisecondSinceEpoch = Math.round((v - 25569 + (date1904 ? 1462 : 0)) * 24 * 3600 * 1000);
  return new Date(millisecondSinceEpoch);
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

// Note: entities contains escapeXml which is used internally
const xmlEncodingMap: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
  "'": "&apos;"
};

export function xmlEncode(text: string): string {
  // Handles special characters:
  // 1. XML entities: < > & " '
  // 2. Control characters (0x00-0x1F except tab, newline, carriage return)
  // 3. Invalid XML characters: 0xFFFE, 0xFFFF
  // 4. Characters that need escaping in attributes

  // First pass: escape XML entities
  let result = text.replace(/[<>&"']/g, char => xmlEncodingMap[char] || char);

  // Second pass: handle control characters and invalid XML characters
  // Valid XML chars: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
  // oxlint-disable-next-line no-control-regex
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFE\uFFFF]/g, char => {
    const code = char.charCodeAt(0);
    // For control characters, use numeric character reference
    // This ensures they can be read back (though some XML parsers may reject them)
    return `&#x${code.toString(16).toUpperCase()};`;
  });

  // Third pass: handle surrogate pairs and other special Unicode
  // This handles characters outside the BMP that might cause issues
  result = result.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    () => {
      // Invalid surrogate - remove or replace
      return "\uFFFD"; // replacement character
    }
  );

  return result;
}

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
  const result = fmt.match(/[ymdhMsb]+/) !== null;
  return result;
}

// Browser version: fileExists always returns false since we don't have fs access
export function fileExists(_path: string): Promise<boolean> {
  return Promise.resolve(false);
}

export function toIsoDateString(dt: Date): string {
  return dt.toISOString().substr(0, 10);
}

export function parseBoolean(value: any): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function* range(start: number, stop: number, step: number = 1): Generator<number> {
  for (let i = start; i < stop; i += step) {
    yield i;
  }
}

export function toSortedArray(values: Iterable<any>): any[] {
  const arr = Array.from(values);
  return arr.sort((a, b) => {
    if (typeof a === "string" && typeof b === "string") {
      return a.localeCompare(b);
    }
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  });
}

export function objectFromProps<T = any>(
  props: string[],
  obj: Record<string, T>
): Record<string, T> {
  const result: Record<string, T> = {};
  props.forEach(prop => {
    result[prop] = obj[prop];
  });
  return result;
}

// Legacy export for backward compatibility

export const utils = {
  dateToExcel,
  excelToDate,
  parsePath,
  getRelsPath,
  xmlEncode,
  xmlDecode,
  validInt,
  isDateFmt,
  toIsoDateString,
  parseBoolean
};

/**
 * Convert Uint8Array, ArrayBuffer, or string to string
 * Browser-compatible version using TextDecoder
 */
export function bufferToString(buffer: Uint8Array | ArrayBuffer | string): string {
  // If already a string, return as-is
  if (typeof buffer === "string") {
    return buffer;
  }
  const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  return new TextDecoder("utf-8").decode(data);
}
