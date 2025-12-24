/**
 * Browser utility functions
 * Re-exports shared utilities and adds browser-specific implementations
 */

// Re-export all shared utilities
export {
  delay,
  nop,
  inherits,
  dateToExcel,
  excelToDate,
  toIsoDateString,
  parsePath,
  getRelsPath,
  xmlDecode,
  validInt,
  isDateFmt,
  parseBoolean,
  range,
  toSortedArray,
  objectFromProps,
  bufferToString
} from "./utils.base.js";

// =============================================================================
// XML encoding (Browser version with full Unicode support)
// =============================================================================

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
    return `&#x${code.toString(16).toUpperCase()};`;
  });

  // Third pass: handle invalid surrogate pairs
  result = result.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    () => "\uFFFD" // replacement character
  );

  return result;
}

// =============================================================================
// File system utilities (Browser stub - always returns false)
// =============================================================================

export function fileExists(_path: string): Promise<boolean> {
  return Promise.resolve(false);
}

// =============================================================================
// Legacy export for backward compatibility
// =============================================================================

import {
  nop,
  inherits,
  dateToExcel,
  excelToDate,
  parsePath,
  getRelsPath,
  xmlDecode,
  validInt,
  isDateFmt,
  toIsoDateString,
  parseBoolean,
  range,
  toSortedArray,
  objectFromProps
} from "./utils.base.js";

/** @deprecated Import functions directly instead of using the utils object */
export const utils = {
  nop,
  inherits,
  dateToExcel,
  excelToDate,
  parsePath,
  getRelsPath,
  xmlEncode,
  xmlDecode,
  validInt,
  isDateFmt,
  fs: {
    exists: fileExists
  },
  toIsoDateString,
  parseBoolean,
  range,
  toSortedArray,
  objectFromProps
};
