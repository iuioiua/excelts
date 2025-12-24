/**
 * CSV fast-csv Compatibility Tests
 *
 * These tests verify compatibility with fast-csv options and behaviors.
 * Edge cases are adapted from fast-csv test suite.
 *
 * @see https://github.com/C2FO/fast-csv
 */

import { describe, it, expect } from "vitest";
import type { CsvParseResult } from "../../../csv/csv-core";
import { parseCsv, formatCsv, parseCsvStream } from "../../../csv/csv-core";
import { CsvParserStream, CsvFormatterStream } from "../../../csv/csv-stream";

// =============================================================================
// Section 1: ignoreEmpty (alias for skipEmptyLines)
// =============================================================================
describe("fast-csv compat - ignoreEmpty", () => {
  it("should ignore empty rows when ignoreEmpty is true", () => {
    const input = "a,b\n\n1,2\n\n3,4";
    const result = parseCsv(input, { ignoreEmpty: true });
    expect(result).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"]
    ]);
  });

  it("should keep empty rows when ignoreEmpty is false", () => {
    const input = "a,b\n\n1,2";
    const result = parseCsv(input, { ignoreEmpty: false });
    expect(result).toEqual([["a", "b"], [""], ["1", "2"]]);
  });

  it("should work with headers", () => {
    const input = "name,age\n\nAlice,30\n\nBob,25";
    const result = parseCsv(input, { headers: true, ignoreEmpty: true }) as CsvParseResult<
      Record<string, string>
    >;
    expect(result.rows).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" }
    ]);
  });
});

// =============================================================================
// Section 2: ltrim and rtrim
// =============================================================================
describe("fast-csv compat - ltrim/rtrim", () => {
  it("should left trim fields when ltrim is true", () => {
    const input = "  a,  b,  c\n  1,  2,  3";
    const result = parseCsv(input, { ltrim: true });
    expect(result).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"]
    ]);
  });

  it("should preserve right whitespace when only ltrim is true", () => {
    const input = "  a  ,  b  \n  1  ,  2  ";
    const result = parseCsv(input, { ltrim: true });
    expect(result).toEqual([
      ["a  ", "b  "],
      ["1  ", "2  "]
    ]);
  });

  it("should right trim fields when rtrim is true", () => {
    const input = "a  ,b  ,c  \n1  ,2  ,3  ";
    const result = parseCsv(input, { rtrim: true });
    expect(result).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"]
    ]);
  });

  it("should preserve left whitespace when only rtrim is true", () => {
    const input = "  a  ,  b  \n  1  ,  2  ";
    const result = parseCsv(input, { rtrim: true });
    expect(result).toEqual([
      ["  a", "  b"],
      ["  1", "  2"]
    ]);
  });

  it("should trim both sides when ltrim and rtrim are both true", () => {
    const input = "  a  ,  b  \n  1  ,  2  ";
    const result = parseCsv(input, { ltrim: true, rtrim: true });
    expect(result).toEqual([
      ["a", "b"],
      ["1", "2"]
    ]);
  });

  it("should work with trim: true (both sides)", () => {
    const input = "  a  ,  b  \n  1  ,  2  ";
    const result = parseCsv(input, { trim: true });
    expect(result).toEqual([
      ["a", "b"],
      ["1", "2"]
    ]);
  });

  it("ltrim should apply after quote extraction", () => {
    // Note: ltrim/rtrim applies to the extracted field value, not just outside quotes
    // This differs slightly from fast-csv which preserves quoted field content
    const input = '"  a  ","  b  "';
    const result = parseCsv(input, { ltrim: true });
    expect(result).toEqual([["a  ", "b  "]]);
  });

  it("rtrim should apply after quote extraction", () => {
    const input = '"  a  ","  b  "';
    const result = parseCsv(input, { rtrim: true });
    expect(result).toEqual([["  a", "  b"]]);
  });
});

// =============================================================================
// Section 3: skipRows (after header detection)
// =============================================================================
describe("fast-csv compat - skipRows", () => {
  it("should skip data rows after headers", () => {
    const input = "name,age\nAlice,30\nBob,25\nCharlie,35";
    const result = parseCsv(input, { headers: true, skipRows: 1 }) as CsvParseResult<
      Record<string, string>
    >;
    expect(result.headers).toEqual(["name", "age"]);
    expect(result.rows).toEqual([
      { name: "Bob", age: "25" },
      { name: "Charlie", age: "35" }
    ]);
  });

  it("should skip multiple data rows", () => {
    const input = "a,b\n1,2\n3,4\n5,6\n7,8";
    const result = parseCsv(input, { headers: true, skipRows: 2 }) as CsvParseResult<
      Record<string, string>
    >;
    expect(result.rows).toEqual([
      { a: "5", b: "6" },
      { a: "7", b: "8" }
    ]);
  });

  it("should work with skipRows > available rows", () => {
    const input = "a,b\n1,2\n3,4";
    const result = parseCsv(input, { headers: true, skipRows: 10 }) as CsvParseResult<
      Record<string, string>
    >;
    expect(result.rows).toEqual([]);
  });

  it("skipRows should be independent of skipLines", () => {
    const input = "comment\na,b\n1,2\n3,4\n5,6";
    const result = parseCsv(input, { headers: true, skipLines: 1, skipRows: 1 }) as CsvParseResult<
      Record<string, string>
    >;
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toEqual([
      { a: "3", b: "4" },
      { a: "5", b: "6" }
    ]);
  });
});

// =============================================================================
// Section 4: renameHeaders
// =============================================================================
describe("fast-csv compat - renameHeaders", () => {
  it("should rename headers from first row", () => {
    const input = "h1,h2,h3\na,b,c";
    const result = parseCsv(input, {
      headers: ["first", "second", "third"],
      renameHeaders: true
    }) as CsvParseResult<Record<string, string>>;
    expect(result.headers).toEqual(["first", "second", "third"]);
    expect(result.rows).toEqual([{ first: "a", second: "b", third: "c" }]);
  });

  it("should discard original header row", () => {
    const input = "old1,old2\nvalue1,value2";
    const result = parseCsv(input, {
      headers: ["new1", "new2"],
      renameHeaders: true
    }) as CsvParseResult<Record<string, string>>;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ new1: "value1", new2: "value2" });
  });

  it("should work without renameHeaders (use first row as data)", () => {
    const input = "a,b\n1,2";
    const result = parseCsv(input, {
      headers: ["col1", "col2"],
      renameHeaders: false
    }) as CsvParseResult<Record<string, string>>;
    expect(result.rows).toEqual([
      { col1: "a", col2: "b" },
      { col1: "1", col2: "2" }
    ]);
  });
});

// =============================================================================
// Section 5: strictColumnHandling
// =============================================================================
describe("fast-csv compat - strictColumnHandling", () => {
  it("should mark rows with too few columns as invalid", () => {
    const input = "a,b,c\n1,2\n3,4,5";
    const result = parseCsv(input, {
      headers: true,
      strictColumnHandling: true
    }) as CsvParseResult<Record<string, string>>;

    expect(result.invalidRows).toBeDefined();
    expect(result.invalidRows).toHaveLength(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ a: "3", b: "4", c: "5" });
  });

  it("should mark rows with too many columns as invalid", () => {
    const input = "a,b\n1,2,3\n4,5";
    const result = parseCsv(input, {
      headers: true,
      strictColumnHandling: true
    }) as CsvParseResult<Record<string, string>>;

    expect(result.invalidRows).toBeDefined();
    expect(result.invalidRows).toHaveLength(1);
    expect(result.rows).toHaveLength(1);
  });

  it("should include reason for invalid rows", () => {
    const input = "a,b\n1\n2,3";
    const result = parseCsv(input, {
      headers: true,
      strictColumnHandling: true
    }) as CsvParseResult<Record<string, string>>;

    expect(result.invalidRows![0].reason).toContain("column");
    expect(result.invalidRows![0].reason).toContain("mismatch");
  });

  it("should not affect rows with correct column count", () => {
    const input = "a,b\n1,2\n3,4";
    const result = parseCsv(input, {
      headers: true,
      strictColumnHandling: true
    }) as CsvParseResult<Record<string, string>>;

    expect(result.invalidRows).toBeUndefined();
    expect(result.rows).toHaveLength(2);
  });

  it("without strictColumnHandling, extra columns are silently discarded", () => {
    const input = "a,b\n1,2,3\n4,5";
    const result = parseCsv(input, { headers: true }) as CsvParseResult<Record<string, string>>;

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("without strictColumnHandling, missing columns are padded", () => {
    const input = "a,b,c\n1,2";
    const result = parseCsv(input, { headers: true }) as CsvParseResult<Record<string, string>>;

    expect(result.rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });
});

// =============================================================================
// Section 6: discardUnmappedColumns
// =============================================================================
describe("fast-csv compat - discardUnmappedColumns", () => {
  it("should discard extra columns when discardUnmappedColumns is true", () => {
    const input = "a,b\n1,2,extra,data";
    const result = parseCsv(input, {
      headers: true,
      discardUnmappedColumns: true
    }) as CsvParseResult<Record<string, string>>;

    expect(result.rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("should work with strictColumnHandling=true (discard takes precedence)", () => {
    const input = "a,b\n1,2,3\n4,5";
    const result = parseCsv(input, {
      headers: true,
      strictColumnHandling: true,
      discardUnmappedColumns: true
    }) as CsvParseResult<Record<string, string>>;

    // When discardUnmappedColumns is true, extra columns are discarded, not marked invalid
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("should not affect rows with correct column count", () => {
    const input = "a,b\n1,2";
    const result = parseCsv(input, {
      headers: true,
      discardUnmappedColumns: true
    }) as CsvParseResult<Record<string, string>>;

    expect(result.rows[0]).toEqual({ a: "1", b: "2" });
  });
});

// =============================================================================
// Section 7: Header transform function
// =============================================================================
describe("fast-csv compat - header transform function", () => {
  it("should transform headers using function", () => {
    const input = "First Name,Last Name\nJohn,Doe";
    const result = parseCsv(input, {
      headers: h => h.map(header => header.toLowerCase().replace(" ", "_"))
    }) as CsvParseResult<Record<string, string>>;

    expect(result.headers).toEqual(["first_name", "last_name"]);
    expect(result.rows[0]).toEqual({ first_name: "John", last_name: "Doe" });
  });

  it("should allow skipping columns by returning undefined/null", () => {
    const input = "a,skip,b\n1,2,3";
    const result = parseCsv(input, {
      headers: h => h.map((header, i) => (i === 1 ? null : header))
    }) as CsvParseResult<Record<string, string>>;

    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows[0]).toEqual({ a: "1", b: "3" });
  });

  it("should throw on duplicate headers after transform", () => {
    const input = "a,b,c\n1,2,3";
    expect(() =>
      parseCsv(input, {
        headers: () => ["same", "same", "other"]
      })
    ).toThrow(/duplicate/i);
  });
});

// =============================================================================
// Section 8: Duplicate header detection
// =============================================================================
describe("fast-csv compat - duplicate headers", () => {
  it("should throw error on duplicate headers", () => {
    const input = "a,b,a\n1,2,3";
    expect(() => parseCsv(input, { headers: true })).toThrow(/duplicate/i);
  });

  it("should throw error when custom headers have duplicates", () => {
    expect(() =>
      parseCsv("a,b,c\n1,2,3", {
        headers: ["x", "y", "x"]
      })
    ).toThrow(/duplicate/i);
  });

  it("should allow duplicate headers with null placeholders", () => {
    const input = "a,b,c\n1,2,3";
    const result = parseCsv(input, {
      headers: ["x", null, "x2"]
    }) as CsvParseResult<Record<string, string>>;

    expect(result.headers).toEqual(["x", "x2"]);
    expect(result.rows[0]).toEqual({ x: "a", x2: "c" });
  });
});

// =============================================================================
// Section 9: quoteColumns and quoteHeaders (formatter)
// =============================================================================
describe("fast-csv compat - quoteColumns/quoteHeaders", () => {
  it("should quote all columns when quoteColumns is true", () => {
    const result = formatCsv(
      [
        ["a", "b"],
        ["1", "2"]
      ],
      { quoteColumns: true, includeEndRowDelimiter: false }
    );
    expect(result).toBe('"a","b"\n"1","2"');
  });

  it("should quote specific columns by index", () => {
    const result = formatCsv(
      [
        ["a", "b", "c"],
        ["1", "2", "3"]
      ],
      { quoteColumns: [true, false, true], includeEndRowDelimiter: false }
    );
    expect(result).toBe('"a",b,"c"\n"1",2,"3"');
  });

  it("should quote specific columns by name", () => {
    const result = formatCsv([{ name: "John", age: "30", city: "NYC" }], {
      headers: ["name", "age", "city"],
      quoteColumns: { name: true, city: true },
      includeEndRowDelimiter: false
    });
    expect(result).toBe('name,age,city\n"John",30,"NYC"');
  });

  it("should quote headers when quoteHeaders is true", () => {
    const result = formatCsv([["1", "2"]], {
      headers: ["col1", "col2"],
      quoteHeaders: true,
      includeEndRowDelimiter: false
    });
    expect(result).toBe('"col1","col2"\n1,2');
  });

  it("should quote specific headers by index", () => {
    const result = formatCsv([["1", "2", "3"]], {
      headers: ["a", "b", "c"],
      quoteHeaders: [true, false, true],
      includeEndRowDelimiter: false
    });
    expect(result).toBe('"a",b,"c"\n1,2,3');
  });
});

// =============================================================================
// Section 10: includeEndRowDelimiter and alwaysWriteHeaders
// =============================================================================
describe("fast-csv compat - includeEndRowDelimiter/alwaysWriteHeaders", () => {
  it("should not include trailing newline by default", () => {
    const result = formatCsv([["a", "b"]]);
    expect(result.endsWith("\n")).toBe(false);
    expect(result).toBe("a,b");
  });

  it("should include trailing newline when includeEndRowDelimiter is true", () => {
    const result = formatCsv([["a", "b"]], { includeEndRowDelimiter: true });
    expect(result.endsWith("\n")).toBe(true);
  });

  it("should write headers with no data when alwaysWriteHeaders is true", () => {
    const result = formatCsv([], {
      headers: ["name", "age"],
      alwaysWriteHeaders: true,
      includeEndRowDelimiter: false
    });
    expect(result).toBe("name,age");
  });

  it("should write empty string with no data when alwaysWriteHeaders is false", () => {
    const result = formatCsv([], {
      headers: ["name", "age"],
      alwaysWriteHeaders: false
    });
    expect(result).toBe("");
  });
});

// =============================================================================
// Section 11: escape option (formatter)
// =============================================================================
describe("fast-csv compat - escape option", () => {
  it("should use default escape (same as quote)", () => {
    const result = formatCsv([['a"b']], { includeEndRowDelimiter: false });
    expect(result).toBe('"a""b"');
  });

  it("should use custom escape character", () => {
    const result = formatCsv([['a"b']], {
      escape: "\\",
      includeEndRowDelimiter: false
    });
    expect(result).toBe('"a\\"b"');
  });

  it("should handle null escape (disable escaping)", () => {
    const result = formatCsv([["a,b"]], {
      escape: null,
      quote: null,
      includeEndRowDelimiter: false
    });
    expect(result).toBe("a,b");
  });
});

// =============================================================================
// Section 12: quote: false option (parser)
// =============================================================================
describe("fast-csv compat - quote: false", () => {
  it("should disable quote parsing when quote is false", () => {
    const input = '"a",b,c';
    const result = parseCsv(input, { quote: false });
    expect(result).toEqual([['"a"', "b", "c"]]);
  });

  it("should disable quote parsing when quote is null", () => {
    const input = '"a",b,"c"';
    const result = parseCsv(input, { quote: null });
    expect(result).toEqual([['"a"', "b", '"c"']]);
  });

  it("should parse quotes as regular characters", () => {
    const input = 'a"b,c"d';
    const result = parseCsv(input, { quote: false });
    expect(result).toEqual([['a"b', 'c"d']]);
  });
});

// =============================================================================
// Section 13: Streaming with new options
// =============================================================================
describe("fast-csv compat - streaming options", () => {
  it("should support ltrim in streaming", async () => {
    const input = "  a,  b\n  1,  2";
    const rows: any[] = [];
    for await (const row of parseCsvStream(input, { ltrim: true })) {
      rows.push(row);
    }
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"]
    ]);
  });

  it("should support rtrim in streaming", async () => {
    const input = "a  ,b  \n1  ,2  ";
    const rows: any[] = [];
    for await (const row of parseCsvStream(input, { rtrim: true })) {
      rows.push(row);
    }
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"]
    ]);
  });

  it("should support skipRows in streaming", async () => {
    const input = "a,b\n1,2\n3,4\n5,6";
    const rows: any[] = [];
    for await (const row of parseCsvStream(input, { headers: true, skipRows: 1 })) {
      rows.push(row);
    }
    expect(rows).toEqual([
      { a: "3", b: "4" },
      { a: "5", b: "6" }
    ]);
  });

  it("should support renameHeaders in streaming", async () => {
    const input = "old1,old2\nval1,val2";
    const rows: any[] = [];
    for await (const row of parseCsvStream(input, {
      headers: ["new1", "new2"],
      renameHeaders: true
    })) {
      rows.push(row);
    }
    expect(rows).toEqual([{ new1: "val1", new2: "val2" }]);
  });

  it("should support ignoreEmpty in streaming", async () => {
    const input = "a,b\n\n1,2\n\n3,4";
    const rows: any[] = [];
    for await (const row of parseCsvStream(input, { ignoreEmpty: true })) {
      rows.push(row);
    }
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"]
    ]);
  });

  it("should support strictColumnHandling in streaming (skip invalid)", async () => {
    const input = "a,b\n1,2,3\n4,5";
    const rows: any[] = [];
    for await (const row of parseCsvStream(input, {
      headers: true,
      strictColumnHandling: true
    })) {
      rows.push(row);
    }
    expect(rows).toEqual([{ a: "4", b: "5" }]);
  });

  it("should support discardUnmappedColumns in streaming", async () => {
    const input = "a,b\n1,2,extra";
    const rows: any[] = [];
    for await (const row of parseCsvStream(input, {
      headers: true,
      discardUnmappedColumns: true
    })) {
      rows.push(row);
    }
    expect(rows).toEqual([{ a: "1", b: "2" }]);
  });
});

// =============================================================================
// Section 14: Edge cases from fast-csv
// =============================================================================
describe("fast-csv compat - edge cases", () => {
  it("should handle empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("should handle single field", () => {
    expect(parseCsv("a")).toEqual([["a"]]);
  });

  it("should handle only newlines with ignoreEmpty", () => {
    expect(parseCsv("\n\n\n", { ignoreEmpty: true })).toEqual([]);
  });

  it("should handle fields with only whitespace", () => {
    const result = parseCsv("   ,   ", { trim: true });
    expect(result).toEqual([["", ""]]);
  });

  it("should handle quoted empty strings", () => {
    const result = parseCsv('"","",""');
    expect(result).toEqual([["", "", ""]]);
  });

  it("should handle mixed quoted and unquoted", () => {
    const result = parseCsv('a,"b",c');
    expect(result).toEqual([["a", "b", "c"]]);
  });

  it("should handle tab delimiter", () => {
    const result = parseCsv("a\tb\tc", { delimiter: "\t" });
    expect(result).toEqual([["a", "b", "c"]]);
  });

  it("should handle pipe delimiter", () => {
    const result = parseCsv("a|b|c", { delimiter: "|" });
    expect(result).toEqual([["a", "b", "c"]]);
  });

  it("should handle semicolon delimiter", () => {
    const result = parseCsv("a;b;c", { delimiter: ";" });
    expect(result).toEqual([["a", "b", "c"]]);
  });

  it("should handle single quote as quote character", () => {
    const result = parseCsv("'a,b',c", { quote: "'" });
    expect(result).toEqual([["a,b", "c"]]);
  });

  it("should handle backslash as escape character", () => {
    const result = parseCsv('"a\\"b"', { escape: "\\" });
    expect(result).toEqual([['a"b']]);
  });

  it("should handle CR line endings", () => {
    const result = parseCsv("a,b\rc,d");
    expect(result).toEqual([
      ["a", "b"],
      ["c", "d"]
    ]);
  });

  it("should handle CRLF line endings", () => {
    const result = parseCsv("a,b\r\nc,d");
    expect(result).toEqual([
      ["a", "b"],
      ["c", "d"]
    ]);
  });

  it("should handle mixed line endings", () => {
    const result = parseCsv("a,b\nc,d\r\ne,f\rg,h");
    expect(result).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
      ["g", "h"]
    ]);
  });

  it("should handle quoted newlines", () => {
    const result = parseCsv('"a\nb",c');
    expect(result).toEqual([["a\nb", "c"]]);
  });

  it("should handle quoted delimiters", () => {
    const result = parseCsv('"a,b",c');
    expect(result).toEqual([["a,b", "c"]]);
  });

  it("should handle escaped quotes in quoted fields", () => {
    const result = parseCsv('"a""b",c');
    expect(result).toEqual([['a"b', "c"]]);
  });

  it("should handle very long fields", () => {
    const longString = "x".repeat(10000);
    const result = parseCsv(`${longString},b`);
    expect(result[0][0]).toBe(longString);
    expect(result[0][0].length).toBe(10000);
  });

  it("should handle many columns", () => {
    const cols = Array(100).fill("x").join(",");
    const result = parseCsv(cols);
    expect(result[0]).toHaveLength(100);
  });

  it("should handle many rows", () => {
    const rows = Array(100).fill("a,b").join("\n");
    const result = parseCsv(rows);
    expect(result).toHaveLength(100);
  });
});

// =============================================================================
// Section 15: BOM handling
// =============================================================================
describe("fast-csv compat - BOM", () => {
  it("should write BOM when writeBOM is true", () => {
    const result = formatCsv([["a", "b"]], { writeBOM: true, includeEndRowDelimiter: false });
    expect(result.charCodeAt(0)).toBe(0xfeff);
    expect(result.slice(1)).toBe("a,b");
  });

  it("should not write BOM by default", () => {
    const result = formatCsv([["a", "b"]], { includeEndRowDelimiter: false });
    expect(result.charCodeAt(0)).not.toBe(0xfeff);
  });
});

// =============================================================================
// Section 16: transform function (CsvParserStream)
// =============================================================================
describe("fast-csv compat - transform (parser stream)", () => {
  const collectRows = (parser: CsvParserStream): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      parser.on("data", (row: any) => rows.push(row));
      parser.on("end", () => resolve(rows));
      parser.on("error", reject);
    });
  };

  it("should support sync transform", async () => {
    const parser = new CsvParserStream({ headers: true });
    parser.transform((row: Record<string, string>) => ({
      firstName: row.first_name?.toUpperCase(),
      lastName: row.last_name?.toUpperCase()
    }));

    const input = "first_name,last_name\nbob,yukon\nsally,yukon";
    parser.end(input);

    const rows = await collectRows(parser);
    expect(rows).toEqual([
      { firstName: "BOB", lastName: "YUKON" },
      { firstName: "SALLY", lastName: "YUKON" }
    ]);
  });

  it("should support async transform", async () => {
    const parser = new CsvParserStream({ headers: true });
    parser.transform((row: Record<string, string>, cb: (err: Error | null, row?: any) => void) => {
      setImmediate(() => {
        cb(null, {
          firstName: row.first_name?.toUpperCase(),
          lastName: row.last_name?.toUpperCase()
        });
      });
    });

    const input = "first_name,last_name\nalice,smith";
    parser.end(input);

    const rows = await collectRows(parser);
    expect(rows).toEqual([{ firstName: "ALICE", lastName: "SMITH" }]);
  });

  it("should handle transform returning null to skip row", async () => {
    const parser = new CsvParserStream({ headers: true });
    parser.transform((row: Record<string, string>) => {
      if (row.skip === "true") {
        return null;
      }
      return row;
    });

    const input = "name,skip\nalice,false\nbob,true\ncharlie,false";
    parser.end(input);

    const rows = await collectRows(parser);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("alice");
    expect(rows[1].name).toBe("charlie");
  });

  it("should handle transform errors", async () => {
    const parser = new CsvParserStream({ headers: true });
    parser.transform(() => {
      throw new Error("Transform error!");
    });

    const input = "a,b\n1,2";
    parser.end(input);

    await expect(collectRows(parser)).rejects.toThrow("Transform error!");
  });

  it("should throw if transform is not a function", () => {
    const parser = new CsvParserStream();
    expect(() => parser.transform("not a function" as any)).toThrow(
      "The transform should be a function"
    );
  });
});

// =============================================================================
// Section 17: validate function (CsvParserStream)
// =============================================================================
describe("fast-csv compat - validate (parser stream)", () => {
  const collectRowsAndInvalid = (
    parser: any
  ): Promise<{ rows: any[]; invalid: Array<{ row: any; reason?: string }> }> => {
    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      const invalid: Array<{ row: any; reason?: string }> = [];

      parser.on("data", (row: any) => rows.push(row));
      parser.on("data-invalid", (row: any, reason?: string) => invalid.push({ row, reason }));
      parser.on("end", () => resolve({ rows, invalid }));
      parser.on("error", reject);
    });
  };

  it("should support sync validate", async () => {
    const parser = new CsvParserStream({ headers: true });
    parser.validate((row: Record<string, string>) => {
      return parseInt(row.age || "0", 10) >= 18;
    });

    const input = "name,age\nalice,25\nbob,15\ncharlie,30";

    // Set up listeners BEFORE calling end
    const promise = collectRowsAndInvalid(parser);
    parser.end(input);

    const { rows, invalid } = await promise;
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("alice");
    expect(rows[1].name).toBe("charlie");
    expect(invalid).toHaveLength(1);
    expect(invalid[0].row.name).toBe("bob");
  });

  it("should support async validate", async () => {
    const parser = new CsvParserStream({ headers: true });
    parser.validate(
      (row: Record<string, string>, cb: (err: Error | null, isValid?: boolean) => void) => {
        setImmediate(() => {
          cb(null, row.name !== "bob");
        });
      }
    );

    const input = "name\nalice\nbob\ncharlie";

    // Set up listeners BEFORE calling end
    const promise = collectRowsAndInvalid(parser);
    parser.end(input);

    const { rows, invalid } = await promise;
    expect(rows).toHaveLength(2);
    expect(invalid).toHaveLength(1);
  });

  it("should support validate with reason", async () => {
    const parser = new CsvParserStream({ headers: true });
    parser.validate(
      (
        row: Record<string, string>,
        cb: (err: Error | null, isValid?: boolean, reason?: string) => void
      ) => {
        if (row.name === "bob") {
          cb(null, false, "Bob is not allowed");
        } else {
          cb(null, true);
        }
      }
    );

    const input = "name\nalice\nbob";

    // Set up listeners BEFORE calling end
    const promise = collectRowsAndInvalid(parser);
    parser.end(input);

    const { rows, invalid } = await promise;
    expect(rows).toHaveLength(1);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].reason).toBe("Bob is not allowed");
  });

  it("should handle validate errors", async () => {
    const parser = new CsvParserStream({ headers: true });
    parser.validate(() => {
      throw new Error("Validation error!");
    });

    const input = "a\n1";
    parser.end(input);

    await expect(collectRowsAndInvalid(parser)).rejects.toThrow("Validation error!");
  });

  it("should throw if validate is not a function", () => {
    const parser = new CsvParserStream();
    // @ts-expect-error Testing runtime type check with invalid argument
    expect(() => parser.validate("not a function")).toThrow("The validate should be a function");
  });
});

// =============================================================================
// Section 18: objectMode option
// =============================================================================
describe("fast-csv compat - objectMode", () => {
  it("should emit objects by default (objectMode: true)", async () => {
    const parser = new CsvParserStream({ headers: true });
    const rows: any[] = [];

    parser.on("data", (row: any) => {
      expect(typeof row).toBe("object");
      rows.push(row);
    });

    // Set up end listener BEFORE calling end
    const endPromise = new Promise<void>(resolve => parser.on("end", resolve));
    parser.end("name,age\nalice,30");

    await endPromise;
    expect(rows[0]).toEqual({ name: "alice", age: "30" });
  });

  it("should emit JSON strings when objectMode is false", async () => {
    const parser = new CsvParserStream({ headers: true, objectMode: false });
    const rows: string[] = [];

    parser.on("data", (chunk: Buffer | string) => {
      // When objectMode is false, streams emit Buffers for string data
      const str = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      rows.push(str);
    });

    // Set up end listener BEFORE calling end
    const endPromise = new Promise<void>(resolve => parser.on("end", resolve));
    parser.end("name,age\nalice,30");

    await endPromise;
    expect(JSON.parse(rows[0])).toEqual({ name: "alice", age: "30" });
  });

  it("formatter should accept objects by default", async () => {
    const formatter = new CsvFormatterStream({ headers: ["name", "age"] });
    const chunks: string[] = [];

    formatter.on("data", (chunk: string) => chunks.push(chunk));
    formatter.write({ name: "alice", age: "30" });
    formatter.end();

    await new Promise<void>(resolve => formatter.on("finish", resolve));
    const output = chunks.join("");
    expect(output).toContain("alice");
    expect(output).toContain("30");
  });
});

// =============================================================================
// Section 19: transform function (CsvFormatterStream)
// =============================================================================
describe("fast-csv compat - transform (formatter stream)", () => {
  it("should support sync transform on formatter", async () => {
    const formatter = new CsvFormatterStream({
      headers: ["name", "age"]
    });

    formatter.transform((row: Record<string, string>) => ({
      name: row.name?.toUpperCase(),
      age: row.age
    }));

    const chunks: string[] = [];
    formatter.on("data", (chunk: string) => chunks.push(chunk));

    formatter.write({ name: "alice", age: "30" });
    formatter.end();

    await new Promise<void>(resolve => formatter.on("finish", resolve));
    const output = chunks.join("");
    expect(output).toContain("ALICE");
  });

  it("should support async transform on formatter", async () => {
    const formatter = new CsvFormatterStream({
      headers: ["name"]
    });

    formatter.transform(
      (row: Record<string, string>, cb: (err: Error | null, row?: any) => void) => {
        setImmediate(() => {
          cb(null, { name: row.name?.toUpperCase() });
        });
      }
    );

    const chunks: string[] = [];
    formatter.on("data", (chunk: string) => chunks.push(chunk));

    formatter.write({ name: "bob" });
    formatter.end();

    await new Promise<void>(resolve => formatter.on("finish", resolve));
    const output = chunks.join("");
    expect(output).toContain("BOB");
  });

  it("should skip row when transform returns null", async () => {
    const formatter = new CsvFormatterStream({
      headers: ["name"]
    });

    formatter.transform((row: Record<string, string>) => {
      if (row.name === "skip") {
        return null;
      }
      return row;
    });

    const chunks: string[] = [];
    formatter.on("data", (chunk: string) => chunks.push(chunk));

    formatter.write({ name: "alice" });
    formatter.write({ name: "skip" });
    formatter.write({ name: "bob" });
    formatter.end();

    await new Promise<void>(resolve => formatter.on("finish", resolve));
    const output = chunks.join("");
    expect(output).toContain("alice");
    expect(output).toContain("bob");
    expect(output).not.toContain("skip");
  });

  it("should throw if transform is not a function", () => {
    const formatter = new CsvFormatterStream();
    // @ts-expect-error Testing runtime type check with invalid argument
    expect(() => formatter.transform("not a function")).toThrow(
      "The transform should be a function"
    );
  });
});

// =============================================================================
// Section 20: Combined transform and validate
// =============================================================================
describe("fast-csv compat - transform + validate", () => {
  it("should apply transform before validate", async () => {
    const parser = new CsvParserStream({ headers: true });

    // Transform adds a computed field
    parser.transform((row: Record<string, string>) => ({
      ...row,
      fullName: `${row.first} ${row.last}`
    }));

    // Validate checks the computed field
    parser.validate((row: Record<string, string>) => {
      return row.fullName?.length > 5;
    });

    const rows: any[] = [];
    const invalid: any[] = [];

    parser.on("data", (row: any) => rows.push(row));
    parser.on("data-invalid", (row: any) => invalid.push(row));

    parser.end("first,last\nBob,Yu\nAlice,Smith");

    await new Promise<void>(resolve => parser.on("end", resolve));

    // "Bob Yu" has length 6 > 5, valid
    // "Alice Smith" has length 11 > 5, valid
    expect(rows).toHaveLength(2);
    expect(rows[0].fullName).toBe("Bob Yu");
    expect(rows[1].fullName).toBe("Alice Smith");
  });
});

// =============================================================================
// Section 21: encoding option (parser)
// =============================================================================
describe("fast-csv compat - encoding option", () => {
  it("should use default encoding (utf8)", async () => {
    const parser = new CsvParserStream();
    const rows: any[] = [];

    parser.on("data", (row: any) => rows.push(row));

    // UTF-8 string
    parser.end("名前,年齢\nAlice,30");

    await new Promise<void>(resolve => parser.on("end", resolve));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["名前", "年齢"]);
    expect(rows[1]).toEqual(["Alice", "30"]);
  });

  it("should accept custom encoding option", async () => {
    const parser = new CsvParserStream({ encoding: "utf8" });
    const rows: any[] = [];

    parser.on("data", (row: any) => rows.push(row));
    parser.end("a,b\n1,2");

    await new Promise<void>(resolve => parser.on("end", resolve));

    expect(rows).toHaveLength(2);
  });

  it("should handle Buffer input with encoding", async () => {
    const parser = new CsvParserStream({ encoding: "utf8" });
    const rows: any[] = [];

    parser.on("data", (row: any) => rows.push(row));

    // Send as Buffer
    const buffer = Buffer.from("你好,世界\n1,2", "utf8");
    parser.end(buffer);

    await new Promise<void>(resolve => parser.on("end", resolve));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["你好", "世界"]);
  });
});

// =============================================================================
// Section 22: writeHeaders option (formatter)
// =============================================================================
describe("fast-csv compat - writeHeaders option", () => {
  it("should write headers by default when headers option is set", () => {
    const result = formatCsv([["1", "2"]], {
      headers: ["a", "b"]
    });
    expect(result).toBe("a,b\n1,2");
  });

  it("should not write headers when writeHeaders is false", () => {
    const result = formatCsv([["1", "2"]], {
      headers: ["a", "b"],
      writeHeaders: false
    });
    expect(result).toBe("1,2");
  });

  it("should write headers when writeHeaders is true", () => {
    const result = formatCsv([["1", "2"]], {
      headers: ["a", "b"],
      writeHeaders: true
    });
    expect(result).toBe("a,b\n1,2");
  });

  it("should work with objects and writeHeaders: false", () => {
    const result = formatCsv([{ name: "Alice", age: "30" }], {
      headers: true,
      writeHeaders: false
    });
    expect(result).toBe("Alice,30");
  });

  it("should work with streaming formatter and writeHeaders: false", async () => {
    const formatter = new CsvFormatterStream({
      headers: ["a", "b"],
      writeHeaders: false
    });
    const chunks: string[] = [];

    formatter.on("data", (chunk: any) => chunks.push(chunk.toString()));

    formatter.write(["1", "2"]);
    formatter.write(["3", "4"]);
    formatter.end();

    await new Promise<void>(resolve => formatter.on("finish", resolve));

    expect(chunks.join("")).toBe("1,2\n3,4");
  });

  it("should respect header order with writeHeaders: false", () => {
    const result = formatCsv([{ b: "2", a: "1" }], {
      headers: ["a", "b"],
      writeHeaders: false
    });
    expect(result).toBe("1,2");
  });
});

// =============================================================================
// Section 23: Edge Cases - Empty and Special Values
// =============================================================================
describe("fast-csv compat - edge cases", () => {
  it("should handle completely empty input", () => {
    const result = parseCsv("");
    expect(result).toEqual([]);
  });

  it("should handle whitespace-only input", () => {
    const result = parseCsv("   ");
    expect(result).toEqual([["   "]]);
  });

  it("should handle single field", () => {
    const result = parseCsv("value");
    expect(result).toEqual([["value"]]);
  });

  it("should handle single quoted field", () => {
    const result = parseCsv('"value"');
    expect(result).toEqual([["value"]]);
  });

  it("should handle empty quoted field", () => {
    const result = parseCsv('""\n');
    expect(result).toEqual([[""]]);
  });

  it("should handle multiple empty quoted fields", () => {
    const result = parseCsv('"","",""');
    expect(result).toEqual([["", "", ""]]);
  });

  it("should handle mixed empty and non-empty fields", () => {
    const result = parseCsv('a,,b,"",c');
    expect(result).toEqual([["a", "", "b", "", "c"]]);
  });

  it("should handle field with only quotes", () => {
    const result = parseCsv('""""');
    expect(result).toEqual([['"']]);
  });

  it("should handle consecutive delimiters", () => {
    const result = parseCsv("a,,,,b");
    expect(result).toEqual([["a", "", "", "", "b"]]);
  });

  it("should handle trailing delimiter", () => {
    const result = parseCsv("a,b,");
    expect(result).toEqual([["a", "b", ""]]);
  });

  it("should handle leading delimiter", () => {
    const result = parseCsv(",a,b");
    expect(result).toEqual([["", "a", "b"]]);
  });

  it("should handle only delimiters", () => {
    const result = parseCsv(",,,");
    expect(result).toEqual([["", "", "", ""]]);
  });

  it("should handle newline in quoted field followed by empty line", () => {
    const input = '"line1\nline2"\n\na,b';
    const result = parseCsv(input, { ignoreEmpty: true });
    expect(result).toEqual([["line1\nline2"], ["a", "b"]]);
  });

  it("should format empty array of objects", () => {
    const result = formatCsv([] as Record<string, any>[], {
      headers: ["a", "b"],
      alwaysWriteHeaders: false
    });
    expect(result).toBe("");
  });

  it("should format objects with undefined values", () => {
    const result = formatCsv([{ a: "1", b: undefined }], { headers: true });
    expect(result).toBe("a,b\n1,");
  });

  it("should format objects with null values", () => {
    const result = formatCsv([{ a: "1", b: null }], { headers: true });
    expect(result).toBe("a,b\n1,");
  });

  it("should handle very long field", () => {
    const longValue = "x".repeat(10000);
    const result = parseCsv(longValue);
    expect(result).toEqual([[longValue]]);
  });

  it("should handle very long quoted field with special chars", () => {
    const longValue = 'a"b,c\n'.repeat(1000);
    const input = `"${longValue.replace(/"/g, '""')}"`;
    const result = parseCsv(input);
    expect(result[0][0]).toBe(longValue);
  });
});

// =============================================================================
// Section 24: Streaming Edge Cases
// =============================================================================
describe("fast-csv compat - streaming edge cases", () => {
  it("should handle empty stream", async () => {
    const parser = new CsvParserStream();
    const rows: any[] = [];

    parser.on("data", (row: any) => rows.push(row));
    parser.end("");

    await new Promise<void>(resolve => parser.on("end", resolve));

    expect(rows).toHaveLength(0);
  });

  it("should handle stream with only header (with trailing newline)", async () => {
    const parser = new CsvParserStream({ headers: true });
    const rows: any[] = [];

    parser.on("data", (row: any) => rows.push(row));
    parser.end("a,b,c\n");

    await new Promise<void>(resolve => parser.on("end", resolve));

    // With only header line and trailing newline, no data rows
    expect(rows).toHaveLength(0);
  });

  it("should emit headers event when parsing with headers: true", async () => {
    const parser = new CsvParserStream({ headers: true });
    let headers: string[] | null = null;

    parser.on("headers", (h: string[]) => {
      headers = h;
    });
    parser.on("data", () => {}); // Consume the stream to allow it to finish
    const endPromise = new Promise<void>(resolve => parser.on("end", resolve));
    parser.end("name,age\nAlice,30");

    await endPromise;

    expect(headers).toEqual(["name", "age"]);
  });

  it("should emit headers event with header transform function", async () => {
    const parser = new CsvParserStream({
      headers: (h: string[]) => h.map(header => header.toUpperCase())
    });
    let headers: string[] | null = null;

    parser.on("headers", (h: string[]) => {
      headers = h;
    });
    parser.on("data", () => {}); // Consume the stream to allow it to finish
    const endPromise = new Promise<void>(resolve => parser.on("end", resolve));
    parser.end("name,age\nAlice,30");

    await endPromise;

    expect(headers).toEqual(["NAME", "AGE"]);
  });

  it("should emit headers event with provided headers array", async () => {
    const parser = new CsvParserStream({ headers: ["col1", "col2"] });
    let headers: string[] | null = null;

    parser.on("headers", (h: string[]) => {
      headers = h;
    });
    parser.on("data", () => {}); // Consume the stream to allow it to finish
    const endPromise = new Promise<void>(resolve => parser.on("end", resolve));
    parser.end("a,b\n1,2");

    await endPromise;

    expect(headers).toEqual(["col1", "col2"]);
  });

  it("should emit headers event with renameHeaders", async () => {
    const parser = new CsvParserStream({
      headers: ["newName", "newAge"],
      renameHeaders: true
    });
    let headers: string[] | null = null;

    parser.on("headers", (h: string[]) => {
      headers = h;
    });
    parser.on("data", () => {}); // Consume the stream to allow it to finish
    const endPromise = new Promise<void>(resolve => parser.on("end", resolve));
    parser.end("name,age\nAlice,30");

    await endPromise;

    expect(headers).toEqual(["newName", "newAge"]);
  });

  it("should handle formatter with no rows written", async () => {
    const formatter = new CsvFormatterStream({ headers: ["a", "b"] });
    const chunks: string[] = [];

    formatter.on("data", (chunk: any) => chunks.push(chunk.toString()));
    formatter.end();

    await new Promise<void>(resolve => formatter.on("finish", resolve));

    // No data, no output (alwaysWriteHeaders defaults to false)
    expect(chunks.join("")).toBe("");
  });

  it("should handle formatter with alwaysWriteHeaders and no rows", async () => {
    const formatter = new CsvFormatterStream({
      headers: ["a", "b"],
      alwaysWriteHeaders: true
    });
    const chunks: string[] = [];

    formatter.on("data", (chunk: any) => chunks.push(chunk.toString()));
    formatter.end();

    await new Promise<void>(resolve => formatter.on("finish", resolve));

    expect(chunks.join("")).toBe("a,b");
  });

  it("should handle includeEndRowDelimiter with streaming", async () => {
    const formatter = new CsvFormatterStream({
      includeEndRowDelimiter: true
    });
    const chunks: string[] = [];

    formatter.on("data", (chunk: any) => chunks.push(chunk.toString()));

    formatter.write(["a", "b"]);
    formatter.end();

    await new Promise<void>(resolve => formatter.on("finish", resolve));

    expect(chunks.join("")).toBe("a,b\n");
  });

  it("should handle chunked input correctly", async () => {
    const parser = new CsvParserStream();
    const rows: any[] = [];

    parser.on("data", (row: any) => rows.push(row));

    // Write data in small chunks
    parser.write("a,");
    parser.write("b\n");
    parser.write("1,");
    parser.write("2");
    parser.end();

    await new Promise<void>(resolve => parser.on("end", resolve));

    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"]
    ]);
  });

  it("should handle chunked quoted field", async () => {
    const parser = new CsvParserStream();
    const rows: any[] = [];

    parser.on("data", (row: any) => rows.push(row));

    // Quote split across chunks
    parser.write('"hel');
    parser.write("lo, wor");
    parser.write('ld",test');
    parser.end();

    await new Promise<void>(resolve => parser.on("end", resolve));

    expect(rows).toEqual([["hello, world", "test"]]);
  });
});

// =============================================================================
// Section 25: rowDelimiter option (formatter)
// =============================================================================
describe("fast-csv compat - rowDelimiter option", () => {
  it("should use LF by default (fast-csv compatible)", () => {
    const result = formatCsv([
      ["a", "b"],
      ["1", "2"]
    ]);
    expect(result).toBe("a,b\n1,2");
    expect(result).toContain("\n");
    expect(result).not.toContain("\r\n");
  });

  it("should support custom rowDelimiter", () => {
    const result = formatCsv(
      [
        ["a", "b"],
        ["1", "2"]
      ],
      { rowDelimiter: "\r\n" }
    );
    expect(result).toBe("a,b\r\n1,2");
  });

  it("should support arbitrary rowDelimiter", () => {
    const result = formatCsv(
      [
        ["a", "b"],
        ["1", "2"]
      ],
      { rowDelimiter: "||" }
    );
    expect(result).toBe("a,b||1,2");
  });

  it("should quote fields containing default row delimiters (newlines)", () => {
    // Note: We quote fields containing \n, \r, or the actual rowDelimiter
    const result = formatCsv([["a\nb", "c"]]);
    expect(result).toBe('"a\nb",c');
  });

  it("should work with streaming formatter", async () => {
    const formatter = new CsvFormatterStream({ rowDelimiter: "\r\n" });
    const chunks: string[] = [];

    formatter.on("data", (chunk: any) => chunks.push(chunk.toString()));

    formatter.write(["a", "b"]);
    formatter.write(["1", "2"]);
    formatter.end();

    await new Promise<void>(resolve => formatter.on("finish", resolve));

    expect(chunks.join("")).toBe("a,b\r\n1,2");
  });
});

// =============================================================================
// Section 26: Combined options
// =============================================================================
describe("fast-csv compat - combined options", () => {
  it("should work with all formatter options combined", () => {
    const result = formatCsv([{ name: "Alice", age: "30" }], {
      headers: ["name", "age"],
      writeHeaders: true,
      delimiter: ";",
      quote: "'",
      escape: "'",
      rowDelimiter: "\r\n",
      quoteColumns: true,
      quoteHeaders: true,
      includeEndRowDelimiter: true,
      writeBOM: false
    });
    expect(result).toBe("'name';'age'\r\n'Alice';'30'\r\n");
  });

  it("should work with all parser options combined", () => {
    const input = "  NAME  ;  AGE  \n  Alice  ;  30  ";
    const result = parseCsv(input, {
      headers: true,
      delimiter: ";",
      trim: true,
      ignoreEmpty: true
    });
    expect((result as CsvParseResult<Record<string, string>>).rows).toEqual([
      { NAME: "Alice", AGE: "30" }
    ]);
  });
});
// =============================================================================
// Section 27: Sync transform and validate in parseCsv (Browser compatible)
// =============================================================================
describe("fast-csv compat - parseCsv sync transform/validate", () => {
  it("should apply sync transform to parsed rows with headers", () => {
    const input = "name,age\nAlice,30\nBob,25";
    const result = parseCsv(input, {
      headers: true,
      transform: (row: Record<string, string>) => ({
        ...row,
        age: String(Number(row.age) * 2)
      })
    }) as CsvParseResult<Record<string, string>>;

    expect(result.rows).toEqual([
      { name: "Alice", age: "60" },
      { name: "Bob", age: "50" }
    ]);
  });

  it("should skip rows when transform returns null", () => {
    const input = "name,age\nAlice,30\nBob,25\nCharlie,35";
    const result = parseCsv(input, {
      headers: true,
      transform: (row: Record<string, string>) => {
        if (Number(row.age) < 30) {
          return null;
        }
        return row;
      }
    }) as CsvParseResult<Record<string, string>>;

    expect(result.rows).toEqual([
      { name: "Alice", age: "30" },
      { name: "Charlie", age: "35" }
    ]);
  });

  it("should apply sync transform to array rows (no headers)", () => {
    const input = "Alice,30\nBob,25";
    const result = parseCsv(input, {
      transform: (row: string[]) => [row[0].toUpperCase(), row[1]]
    }) as string[][];

    expect(result).toEqual([
      ["ALICE", "30"],
      ["BOB", "25"]
    ]);
  });

  it("should apply sync validate to parsed rows with headers", () => {
    const input = "name,age\nAlice,30\nBob,25\nCharlie,35";
    const result = parseCsv(input, {
      headers: true,
      validate: (row: Record<string, string>) => Number(row.age) >= 30
    }) as CsvParseResult<Record<string, string>>;

    expect(result.rows).toEqual([
      { name: "Alice", age: "30" },
      { name: "Charlie", age: "35" }
    ]);
    expect(result.invalidRows).toEqual([{ row: ["Bob", "25"], reason: "Validation failed" }]);
  });

  it("should apply sync validate with custom reason", () => {
    const input = "name,age\nAlice,30\nBob,25";
    const result = parseCsv(input, {
      headers: true,
      validate: (row: Record<string, string>) => {
        if (Number(row.age) < 30) {
          return { isValid: false, reason: `Age ${row.age} is below minimum` };
        }
        return { isValid: true };
      }
    }) as CsvParseResult<Record<string, string>>;

    expect(result.rows).toEqual([{ name: "Alice", age: "30" }]);
    expect(result.invalidRows).toEqual([{ row: ["Bob", "25"], reason: "Age 25 is below minimum" }]);
  });

  it("should apply sync validate to array rows (no headers)", () => {
    const input = "Alice,30\nBob,25\nCharlie,35";
    const result = parseCsv(input, {
      validate: (row: string[]) => Number(row[1]) >= 30
    }) as any;

    expect(result.rows).toEqual([
      ["Alice", "30"],
      ["Charlie", "35"]
    ]);
    expect(result.invalidRows).toEqual([{ row: ["Bob", "25"], reason: "Validation failed" }]);
  });

  it("should apply transform before validate", () => {
    const input = "name,age\nAlice,15\nBob,25";
    const result = parseCsv(input, {
      headers: true,
      transform: (row: Record<string, string>) => ({
        ...row,
        age: String(Number(row.age) * 2) // Double the age
      }),
      validate: (row: Record<string, string>) => Number(row.age) >= 30
    }) as CsvParseResult<Record<string, string>>;

    // Alice: 15*2=30 (valid), Bob: 25*2=50 (valid)
    expect(result.rows).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "50" }
    ]);
  });

  it("should handle transform and validate with skipped rows", () => {
    const input = "name,age\nAlice,30\n,25\nCharlie,35";
    const result = parseCsv(input, {
      headers: true,
      transform: (row: Record<string, string>) => {
        if (!row.name) {
          return null;
        } // Skip rows without name
        return row;
      },
      validate: (row: Record<string, string>) => Number(row.age) >= 30
    }) as CsvParseResult<Record<string, string>>;

    expect(result.rows).toEqual([
      { name: "Alice", age: "30" },
      { name: "Charlie", age: "35" }
    ]);
    // No invalid rows because transform removed the empty name row before validation
    expect(result.invalidRows).toBeUndefined();
  });
});

// =============================================================================
// Section 28: Sync transform in formatCsv (Browser compatible)
// =============================================================================
describe("fast-csv compat - formatCsv sync transform", () => {
  it("should apply sync transform to formatted rows (objects)", () => {
    const result = formatCsv(
      [
        { name: "alice", age: "30" },
        { name: "bob", age: "25" }
      ],
      {
        headers: true,
        transform: (row: Record<string, string>) => ({
          ...row,
          name: row.name.toUpperCase()
        })
      }
    );
    expect(result).toBe("name,age\nALICE,30\nBOB,25");
  });

  it("should skip rows when transform returns null (objects)", () => {
    const result = formatCsv(
      [
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
        { name: "Charlie", age: "35" }
      ],
      {
        headers: true,
        transform: (row: Record<string, string>) => {
          if (Number(row.age) < 30) {
            return null;
          }
          return row;
        }
      }
    );
    expect(result).toBe("name,age\nAlice,30\nCharlie,35");
  });

  it("should apply sync transform to formatted rows (arrays)", () => {
    const result = formatCsv(
      [
        ["alice", "30"],
        ["bob", "25"]
      ],
      {
        transform: (row: string[]) => [row[0].toUpperCase(), row[1]]
      }
    );
    expect(result).toBe("ALICE,30\nBOB,25");
  });

  it("should skip rows when transform returns null (arrays)", () => {
    const result = formatCsv(
      [
        ["Alice", "30"],
        ["Bob", "25"],
        ["Charlie", "35"]
      ],
      {
        transform: (row: string[]) => {
          if (Number(row[1]) < 30) {
            return null;
          }
          return row;
        }
      }
    );
    expect(result).toBe("Alice,30\nCharlie,35");
  });

  it("should work with headers and transform together", () => {
    const result = formatCsv(
      [
        ["alice", "30"],
        ["bob", "25"]
      ],
      {
        headers: ["Name", "Age"],
        transform: (row: string[]) => [row[0].toUpperCase(), row[1]]
      }
    );
    expect(result).toBe("Name,Age\nALICE,30\nBOB,25");
  });
});
