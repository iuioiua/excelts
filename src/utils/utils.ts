/**
 * Node.js utility functions
 * Re-exports shared utilities and adds Node.js-specific implementations
 */

import fs from "fs";

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
// XML encoding (Node.js optimized version)
// =============================================================================

// oxlint-disable-next-line no-control-regex -- Control characters are intentionally matched for XML encoding
const xmlDecodeRegex = /[<>&'"\x7F\x00-\x08\x0B-\x0C\x0E-\x1F]/;

export function xmlEncode(text: string): string {
  const regexResult = xmlDecodeRegex.exec(text);
  if (!regexResult) {
    return text;
  }

  let result = "";
  let escape = "";
  let lastIndex = 0;
  let i = regexResult.index;
  for (; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    switch (charCode) {
      case 34: // "
        escape = "&quot;";
        break;
      case 38: // &
        escape = "&amp;";
        break;
      case 39: // '
        escape = "&apos;";
        break;
      case 60: // <
        escape = "&lt;";
        break;
      case 62: // >
        escape = "&gt;";
        break;
      case 127:
        escape = "";
        break;
      default: {
        if (charCode <= 31 && (charCode <= 8 || (charCode >= 11 && charCode !== 13))) {
          escape = "";
          break;
        }
        continue;
      }
    }
    if (lastIndex !== i) {
      result += text.substring(lastIndex, i);
    }
    lastIndex = i + 1;
    if (escape) {
      result += escape;
    }
  }
  if (lastIndex !== i) {
    return result + text.substring(lastIndex, i);
  }
  return result;
}

// =============================================================================
// File system utilities (Node.js only)
// =============================================================================

export function fileExists(path: string): Promise<boolean> {
  return new Promise(resolve => {
    fs.access(path, fs.constants.F_OK, err => {
      resolve(!err);
    });
  });
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
