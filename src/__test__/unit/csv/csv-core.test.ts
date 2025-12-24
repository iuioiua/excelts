/**
 * CSV Core Unit Tests - RFC 4180 Compliance
 *
 * Tests the native CSV parser and formatter for compliance with RFC 4180:
 * @see https://tools.ietf.org/html/rfc4180
 *
 * RFC 4180 Key Points:
 * 1. Each record is on a separate line, delimited by CRLF
 * 2. Optional header line with same format as records
 * 3. Fields are separated by commas
 * 4. Fields containing commas, double-quotes, or line breaks must be enclosed in double-quotes
 * 5. Double-quotes in fields are escaped by doubling them
 * 6. Spaces are part of the field and should not be trimmed
 */

import { describe, it, expect } from "vitest";
import { parseCsv, formatCsv, parseCsvStream } from "../../../csv/csv-core";

describe("CSV Core - RFC 4180 Compliance", () => {
  // ===========================================================================
  // Section 1: Basic Parsing
  // ===========================================================================
  describe("parseCsv - Basic Parsing", () => {
    it("should parse simple CSV with commas", () => {
      const input = "a,b,c\n1,2,3";
      const result = parseCsv(input);
      expect(result).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"]
      ]);
    });

    it("should handle CRLF line endings (RFC 4180 standard)", () => {
      const input = "a,b,c\r\n1,2,3\r\n4,5,6";
      const result = parseCsv(input);
      expect(result).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"],
        ["4", "5", "6"]
      ]);
    });

    it("should handle CR only line endings", () => {
      const input = "a,b,c\r1,2,3";
      const result = parseCsv(input);
      expect(result).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"]
      ]);
    });

    it("should handle LF only line endings", () => {
      const input = "a,b,c\n1,2,3";
      const result = parseCsv(input);
      expect(result).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"]
      ]);
    });

    it("should handle empty input", () => {
      const result = parseCsv("");
      expect(result).toEqual([]);
    });

    it("should handle single field", () => {
      const result = parseCsv("hello");
      expect(result).toEqual([["hello"]]);
    });

    it("should handle single row with multiple fields", () => {
      const result = parseCsv("a,b,c,d,e");
      expect(result).toEqual([["a", "b", "c", "d", "e"]]);
    });

    it("should handle trailing newline", () => {
      const input = "a,b,c\n1,2,3\n";
      const result = parseCsv(input);
      expect(result).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"]
      ]);
    });
  });

  // ===========================================================================
  // Section 2: Quoted Fields (RFC 4180 Section 2.5, 2.6, 2.7)
  // ===========================================================================
  describe("parseCsv - Quoted Fields", () => {
    it("should parse quoted fields containing commas", () => {
      const input = '"hello, world",test';
      const result = parseCsv(input);
      expect(result).toEqual([["hello, world", "test"]]);
    });

    it("should parse quoted fields containing newlines", () => {
      const input = '"line1\nline2",test';
      const result = parseCsv(input);
      expect(result).toEqual([["line1\nline2", "test"]]);
    });

    it("should parse quoted fields containing CRLF", () => {
      const input = '"line1\r\nline2",test';
      const result = parseCsv(input);
      // After normalization, \r\n becomes \n
      expect(result).toEqual([["line1\nline2", "test"]]);
    });

    it("should parse escaped double-quotes (RFC 4180 Section 2.7)", () => {
      const input = '"He said ""Hello""",test';
      const result = parseCsv(input);
      expect(result).toEqual([['He said "Hello"', "test"]]);
    });

    it("should handle multiple escaped quotes", () => {
      const input = '"""quoted""",""""';
      const result = parseCsv(input);
      expect(result).toEqual([['"quoted"', '"']]);
    });

    it("should handle empty quoted field", () => {
      const input = '"",test,""';
      const result = parseCsv(input);
      expect(result).toEqual([["", "test", ""]]);
    });

    it("should handle quoted field at end of row", () => {
      const input = 'a,b,"c,d"';
      const result = parseCsv(input);
      expect(result).toEqual([["a", "b", "c,d"]]);
    });

    it("should handle quoted field at start of row", () => {
      const input = '"a,b",c,d';
      const result = parseCsv(input);
      expect(result).toEqual([["a,b", "c", "d"]]);
    });

    it("should handle all quoted fields", () => {
      const input = '"a","b","c"';
      const result = parseCsv(input);
      expect(result).toEqual([["a", "b", "c"]]);
    });

    it("should handle quoted fields with only quotes inside", () => {
      const input = '""""';
      const result = parseCsv(input);
      expect(result).toEqual([['"']]);
    });
  });

  // ===========================================================================
  // Section 3: Empty Fields and Rows
  // ===========================================================================
  describe("parseCsv - Empty Fields and Rows", () => {
    it("should handle empty fields", () => {
      const input = "a,,c";
      const result = parseCsv(input);
      expect(result).toEqual([["a", "", "c"]]);
    });

    it("should handle multiple consecutive empty fields", () => {
      const input = "a,,,d";
      const result = parseCsv(input);
      expect(result).toEqual([["a", "", "", "d"]]);
    });

    it("should handle empty field at start", () => {
      const input = ",b,c";
      const result = parseCsv(input);
      expect(result).toEqual([["", "b", "c"]]);
    });

    it("should handle empty field at end", () => {
      const input = "a,b,";
      const result = parseCsv(input);
      expect(result).toEqual([["a", "b", ""]]);
    });

    it("should handle row with only empty fields", () => {
      const input = ",,";
      const result = parseCsv(input);
      expect(result).toEqual([["", "", ""]]);
    });

    it("should handle empty rows when skipEmptyLines is false", () => {
      const input = "a,b\n\nc,d";
      const result = parseCsv(input, { skipEmptyLines: false });
      expect(result).toEqual([["a", "b"], [""], ["c", "d"]]);
    });

    it("should skip empty rows when skipEmptyLines is true", () => {
      const input = "a,b\n\nc,d";
      const result = parseCsv(input, { skipEmptyLines: true });
      expect(result).toEqual([
        ["a", "b"],
        ["c", "d"]
      ]);
    });
  });

  // ===========================================================================
  // Section 4: Whitespace Handling (RFC 4180 Section 2.4)
  // ===========================================================================
  describe("parseCsv - Whitespace Handling", () => {
    it("should preserve leading/trailing spaces by default (RFC 4180)", () => {
      const input = " a , b , c ";
      const result = parseCsv(input);
      expect(result).toEqual([[" a ", " b ", " c "]]);
    });

    it("should trim whitespace when trim option is true", () => {
      const input = " a , b , c ";
      const result = parseCsv(input, { trim: true });
      expect(result).toEqual([["a", "b", "c"]]);
    });

    it("should preserve spaces inside quoted fields", () => {
      const input = '" a "," b "';
      const result = parseCsv(input);
      expect(result).toEqual([[" a ", " b "]]);
    });

    it("should preserve tabs as part of field", () => {
      const input = "a\tb,c";
      const result = parseCsv(input);
      expect(result).toEqual([["a\tb", "c"]]);
    });
  });

  // ===========================================================================
  // Section 5: Custom Delimiters
  // ===========================================================================
  describe("parseCsv - Custom Delimiters", () => {
    it("should support tab delimiter (TSV)", () => {
      const input = "a\tb\tc\n1\t2\t3";
      const result = parseCsv(input, { delimiter: "\t" });
      expect(result).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"]
      ]);
    });

    it("should support semicolon delimiter", () => {
      const input = "a;b;c\n1;2;3";
      const result = parseCsv(input, { delimiter: ";" });
      expect(result).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"]
      ]);
    });

    it("should support pipe delimiter", () => {
      const input = "a|b|c\n1|2|3";
      const result = parseCsv(input, { delimiter: "|" });
      expect(result).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"]
      ]);
    });

    it("should handle quoted fields with custom delimiter", () => {
      const input = '"a;b";c;d';
      const result = parseCsv(input, { delimiter: ";" });
      expect(result).toEqual([["a;b", "c", "d"]]);
    });
  });

  // ===========================================================================
  // Section 6: Custom Quote Character
  // ===========================================================================
  describe("parseCsv - Custom Quote Character", () => {
    it("should support single quote as quote character", () => {
      const input = "'hello, world',test";
      const result = parseCsv(input, { quote: "'" });
      expect(result).toEqual([["hello, world", "test"]]);
    });

    it("should handle escaped single quotes", () => {
      const input = "'It''s a test',value";
      const result = parseCsv(input, { quote: "'", escape: "'" });
      expect(result).toEqual([["It's a test", "value"]]);
    });

    it("should disable quoting when quote is null", () => {
      const input = '"hello",world';
      const result = parseCsv(input, { quote: null });
      // Without quoting, the quotes are literal characters
      expect(result).toEqual([['"hello"', "world"]]);
    });

    it("should disable quoting when quote is false", () => {
      const input = '"hello",world';
      const result = parseCsv(input, { quote: false });
      expect(result).toEqual([['"hello"', "world"]]);
    });
  });

  // ===========================================================================
  // Section 7: Headers Option
  // ===========================================================================
  describe("parseCsv - Headers", () => {
    it("should return objects when headers option is true", () => {
      const input = "name,age,city\nAlice,30,NYC\nBob,25,LA";
      const result = parseCsv(input, { headers: true }) as any;
      expect(result.headers).toEqual(["name", "age", "city"]);
      expect(result.rows).toEqual([
        { name: "Alice", age: "30", city: "NYC" },
        { name: "Bob", age: "25", city: "LA" }
      ]);
    });

    it("should handle missing fields in data rows", () => {
      const input = "a,b,c\n1,2";
      const result = parseCsv(input, { headers: true }) as any;
      expect(result.rows).toEqual([{ a: "1", b: "2", c: "" }]);
    });

    it("should handle extra fields in data rows", () => {
      const input = "a,b\n1,2,3";
      const result = parseCsv(input, { headers: true }) as any;
      expect(result.rows).toEqual([{ a: "1", b: "2" }]);
    });
  });

  // ===========================================================================
  // Section 8: Skip Lines and Comments
  // ===========================================================================
  describe("parseCsv - Skip Lines and Comments", () => {
    it("should skip lines at beginning", () => {
      const input = "header line\ncomment line\na,b,c\n1,2,3";
      const result = parseCsv(input, { skipLines: 2 });
      expect(result).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"]
      ]);
    });

    it("should skip comment lines", () => {
      const input = "a,b,c\n# this is a comment\n1,2,3";
      const result = parseCsv(input, { comment: "#" });
      expect(result).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"]
      ]);
    });

    it("should handle multiple comment lines", () => {
      const input = "# comment 1\n# comment 2\na,b,c";
      const result = parseCsv(input, { comment: "#" });
      expect(result).toEqual([["a", "b", "c"]]);
    });
  });

  // ===========================================================================
  // Section 9: Max Rows Option
  // ===========================================================================
  describe("parseCsv - Max Rows", () => {
    it("should limit number of rows parsed", () => {
      const input = "a,b\n1,2\n3,4\n5,6\n7,8";
      const result = parseCsv(input, { maxRows: 2 });
      expect(result).toEqual([
        ["a", "b"],
        ["1", "2"]
      ]);
    });

    it("should handle maxRows with headers", () => {
      const input = "name,age\nAlice,30\nBob,25\nCharlie,35";
      const result = parseCsv(input, { headers: true, maxRows: 2 }) as any;
      expect(result.headers).toEqual(["name", "age"]);
      expect(result.rows).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Section 10: Unicode Support
  // ===========================================================================
  describe("parseCsv - Unicode Support", () => {
    it("should handle UTF-8 characters", () => {
      const input = "名前,年齢\n田中,30\n鈴木,25";
      const result = parseCsv(input);
      expect(result).toEqual([
        ["名前", "年齢"],
        ["田中", "30"],
        ["鈴木", "25"]
      ]);
    });

    it("should handle emoji", () => {
      const input = "emoji,text\n😀,smile\n🎉,party";
      const result = parseCsv(input);
      expect(result).toEqual([
        ["emoji", "text"],
        ["😀", "smile"],
        ["🎉", "party"]
      ]);
    });

    it("should handle Chinese characters in quoted fields", () => {
      const input = '"你好,世界",测试';
      const result = parseCsv(input);
      expect(result).toEqual([["你好,世界", "测试"]]);
    });

    it("should handle mixed scripts", () => {
      const input = "English,日本語,한국어,العربية";
      const result = parseCsv(input);
      expect(result).toEqual([["English", "日本語", "한국어", "العربية"]]);
    });
  });

  // ===========================================================================
  // Section 11: formatCsv - Basic Formatting
  // ===========================================================================
  describe("formatCsv - Basic Formatting", () => {
    it("should format simple 2D array", () => {
      const data = [
        ["a", "b", "c"],
        ["1", "2", "3"]
      ];
      const result = formatCsv(data);
      expect(result).toBe("a,b,c\n1,2,3");
    });

    it("should use LF as row delimiter (fast-csv compatible)", () => {
      const data = [["a"], ["b"]];
      const result = formatCsv(data);
      expect(result).toBe("a\nb");
      expect(result).toContain("");
    });

    it("should handle empty data", () => {
      const result = formatCsv([]);
      expect(result).toBe("");
    });

    it("should handle single row", () => {
      const result = formatCsv([["a", "b", "c"]]);
      expect(result).toBe("a,b,c");
    });

    it("should handle null and undefined values", () => {
      const data = [[null, undefined, "value"]];
      const result = formatCsv(data as any);
      expect(result).toBe(",,value");
    });

    it("should convert numbers and booleans to strings", () => {
      const data = [[1, 2.5, true, false]];
      const result = formatCsv(data as any);
      expect(result).toBe("1,2.5,true,false");
    });
  });

  // ===========================================================================
  // Section 12: formatCsv - Quoting (RFC 4180 Section 2.5, 2.6, 2.7)
  // ===========================================================================
  describe("formatCsv - Quoting", () => {
    it("should quote fields containing commas", () => {
      const data = [["hello, world", "test"]];
      const result = formatCsv(data);
      expect(result).toBe('"hello, world",test');
    });

    it("should quote fields containing double-quotes and escape them", () => {
      const data = [['He said "Hello"', "test"]];
      const result = formatCsv(data);
      expect(result).toBe('"He said ""Hello""",test');
    });

    it("should quote fields containing newlines", () => {
      const data = [["line1\nline2", "test"]];
      const result = formatCsv(data);
      expect(result).toBe('"line1\nline2",test');
    });

    it("should quote fields containing CRLF", () => {
      const data = [["line1\r\nline2", "test"]];
      const result = formatCsv(data);
      expect(result).toBe('"line1\r\nline2",test');
    });

    it("should quote fields containing only quotes", () => {
      const data = [['"']];
      const result = formatCsv(data);
      expect(result).toBe('""""');
    });

    it("should handle alwaysQuote option", () => {
      const data = [["a", "b", "c"]];
      const result = formatCsv(data, { alwaysQuote: true });
      expect(result).toBe('"a","b","c"');
    });

    it("should not quote when quote is disabled (false)", () => {
      const data = [["hello, world", "test"]];
      const result = formatCsv(data, { quote: false });
      // When quoting is disabled, commas are literal (may break parsing)
      expect(result).toBe("hello, world,test");
    });

    it("should not quote when quote is disabled (null)", () => {
      const data = [["hello, world", "test"]];
      const result = formatCsv(data, { quote: null });
      expect(result).toBe("hello, world,test");
    });
  });

  // ===========================================================================
  // Section 13: formatCsv - Custom Options
  // ===========================================================================
  describe("formatCsv - Custom Options", () => {
    it("should support custom delimiter", () => {
      const data = [["a", "b", "c"]];
      const result = formatCsv(data, { delimiter: "\t" });
      expect(result).toBe("a\tb\tc");
    });

    it("should support custom quote character", () => {
      const data = [["hello, world", "test"]];
      const result = formatCsv(data, { quote: "'" });
      expect(result).toBe("'hello, world',test");
    });

    it("should support custom row delimiter", () => {
      const data = [
        ["a", "b"],
        ["1", "2"]
      ];
      const result = formatCsv(data, { rowDelimiter: "\n" });
      expect(result).toBe("a,b\n1,2");
    });

    it("should add BOM when writeBOM is true", () => {
      const data = [["a", "b"]];
      const result = formatCsv(data, { writeBOM: true });
      expect(result.charCodeAt(0)).toBe(0xfeff);
      expect(result).toBe("\uFEFFa,b");
    });
  });

  // ===========================================================================
  // Section 14: formatCsv - Headers
  // ===========================================================================
  describe("formatCsv - Headers", () => {
    it("should add custom headers to 2D array", () => {
      const data = [
        ["1", "2", "3"],
        ["4", "5", "6"]
      ];
      const result = formatCsv(data, { headers: ["a", "b", "c"] });
      expect(result).toBe("a,b,c\n1,2,3\n4,5,6");
    });

    it("should format array of objects with headers: true", () => {
      const data = [
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" }
      ];
      const result = formatCsv(data, { headers: true });
      expect(result).toBe("name,age\nAlice,30\nBob,25");
    });

    it("should format objects with custom header order", () => {
      const data = [
        { name: "Alice", age: "30", city: "NYC" },
        { name: "Bob", age: "25", city: "LA" }
      ];
      const result = formatCsv(data, { headers: ["city", "name", "age"] });
      expect(result).toBe("city,name,age\nNYC,Alice,30\nLA,Bob,25");
    });
  });

  // ===========================================================================
  // Section 15: formatCsv - Unicode
  // ===========================================================================
  describe("formatCsv - Unicode", () => {
    it("should format UTF-8 characters", () => {
      const data = [
        ["名前", "年齢"],
        ["田中", "30"]
      ];
      const result = formatCsv(data);
      expect(result).toBe("名前,年齢\n田中,30");
    });

    it("should quote Unicode fields containing delimiters", () => {
      const data = [["你好,世界", "测试"]];
      const result = formatCsv(data);
      expect(result).toBe('"你好,世界",测试');
    });
  });

  // ===========================================================================
  // Section 16: Round-trip Tests (Parse + Format)
  // ===========================================================================
  describe("Round-trip Tests", () => {
    it("should round-trip simple data", () => {
      const original = [
        ["a", "b", "c"],
        ["1", "2", "3"]
      ];
      const csv = formatCsv(original);
      const parsed = parseCsv(csv);
      expect(parsed).toEqual(original);
    });

    it("should round-trip data with commas", () => {
      const original = [["hello, world", "test"]];
      const csv = formatCsv(original);
      const parsed = parseCsv(csv);
      expect(parsed).toEqual(original);
    });

    it("should round-trip data with quotes", () => {
      const original = [['He said "Hello"', "test"]];
      const csv = formatCsv(original);
      const parsed = parseCsv(csv);
      expect(parsed).toEqual(original);
    });

    it("should round-trip data with newlines", () => {
      const original = [["line1\nline2", "test"]];
      const csv = formatCsv(original);
      const parsed = parseCsv(csv);
      expect(parsed).toEqual(original);
    });

    it("should round-trip Unicode data", () => {
      const original = [
        ["名前", "年齢"],
        ["田中,太郎", "30"]
      ];
      const csv = formatCsv(original);
      const parsed = parseCsv(csv);
      expect(parsed).toEqual(original);
    });

    it("should round-trip complex data", () => {
      const original = [
        ["Name", "Description", "Price"],
        ["Widget", 'A "great" product, really!', "19.99"],
        ["Gadget", "Multi-line\ndescription", "29.99"],
        ["Thing", "", "9.99"]
      ];
      const csv = formatCsv(original);
      const parsed = parseCsv(csv);
      expect(parsed).toEqual(original);
    });
  });

  // ===========================================================================
  // Section 17: Streaming Parser
  // ===========================================================================
  describe("parseCsvStream - Streaming Parser", () => {
    it("should stream parse simple CSV", async () => {
      const input = "a,b,c\n1,2,3\n4,5,6";
      const rows: string[][] = [];
      for await (const row of parseCsvStream(input)) {
        rows.push(row as string[]);
      }
      expect(rows).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"],
        ["4", "5", "6"]
      ]);
    });

    it("should stream parse with headers", async () => {
      const input = "name,age\nAlice,30\nBob,25";
      const rows: Record<string, string>[] = [];
      for await (const row of parseCsvStream(input, { headers: true })) {
        rows.push(row as Record<string, string>);
      }
      expect(rows).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" }
      ]);
    });

    it("should stream parse with maxRows limit", async () => {
      const input = "a,b\n1,2\n3,4\n5,6";
      const rows: string[][] = [];
      for await (const row of parseCsvStream(input, { maxRows: 2 })) {
        rows.push(row as string[]);
      }
      expect(rows).toEqual([
        ["a", "b"],
        ["1", "2"]
      ]);
    });

    it("should stream parse quoted fields", async () => {
      const input = '"hello, world",test\n"line1\nline2",value';
      const rows: string[][] = [];
      for await (const row of parseCsvStream(input)) {
        rows.push(row as string[]);
      }
      expect(rows).toEqual([
        ["hello, world", "test"],
        ["line1\nline2", "value"]
      ]);
    });

    it("should stream parse from async iterable", async () => {
      async function* chunks() {
        yield "a,b,";
        yield "c\n1,2,3";
      }
      const rows: string[][] = [];
      for await (const row of parseCsvStream(chunks())) {
        rows.push(row as string[]);
      }
      expect(rows).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"]
      ]);
    });

    it("should handle chunks splitting in middle of field", async () => {
      async function* chunks() {
        yield "hel";
        yield "lo,wor";
        yield "ld\n";
      }
      const rows: string[][] = [];
      for await (const row of parseCsvStream(chunks())) {
        rows.push(row as string[]);
      }
      expect(rows).toEqual([["hello", "world"]]);
    });

    it("should handle chunks splitting in middle of quoted field", async () => {
      async function* chunks() {
        yield '"hello, ';
        yield 'world",test\n';
      }
      const rows: string[][] = [];
      for await (const row of parseCsvStream(chunks())) {
        rows.push(row as string[]);
      }
      expect(rows).toEqual([["hello, world", "test"]]);
    });
  });

  // ===========================================================================
  // Section 18: Edge Cases
  // ===========================================================================
  describe("Edge Cases", () => {
    it("should handle very long fields", () => {
      const longString = "a".repeat(10000);
      const data = [[longString]];
      const csv = formatCsv(data);
      const parsed = parseCsv(csv);
      expect(parsed).toEqual(data);
    });

    it("should handle many columns", () => {
      const cols = Array.from({ length: 100 }, (_, i) => `col${i}`);
      const data = [cols];
      const csv = formatCsv(data);
      const parsed = parseCsv(csv);
      expect(parsed).toEqual(data);
    });

    it("should handle many rows", () => {
      const data = Array.from({ length: 1000 }, (_, i) => [`row${i}`, `value${i}`]);
      const csv = formatCsv(data);
      const parsed = parseCsv(csv);
      expect(parsed).toEqual(data);
    });

    it("should handle field with only whitespace", () => {
      const input = "   ,\t\t,   ";
      const result = parseCsv(input);
      expect(result).toEqual([["   ", "\t\t", "   "]]);
    });

    it("should handle numeric-looking strings", () => {
      const input = "01234,00100,1e10";
      const result = parseCsv(input);
      // Should be parsed as strings, not numbers
      expect(result).toEqual([["01234", "00100", "1e10"]]);
    });

    it("should handle special characters", () => {
      const input = "\\n,\\r,\\t,\\\\";
      const result = parseCsv(input);
      expect(result).toEqual([["\\n", "\\r", "\\t", "\\\\"]]);
    });
  });

  // ===========================================================================
  // Section 19: RFC 4180 Specific Tests
  // ===========================================================================
  describe("RFC 4180 Specific Compliance", () => {
    it("Rule 1: Each record on separate line with LF (fast-csv compatible)", () => {
      const data = [
        ["a", "b"],
        ["c", "d"]
      ];
      const csv = formatCsv(data);
      expect(csv).toBe("a,b\nc,d");
    });

    it("Rule 2: Optional header line", () => {
      const data = [{ col1: "val1", col2: "val2" }];
      const withHeader = formatCsv(data, { headers: true });
      expect(withHeader).toContain("col1,col2");
    });

    it("Rule 3: Fields separated by single comma", () => {
      const csv = "a,b,c";
      const result = parseCsv(csv);
      expect(result).toEqual([["a", "b", "c"]]);
    });

    it("Rule 4: Fields may be quoted", () => {
      const csv = '"a","b","c"';
      const result = parseCsv(csv);
      expect(result).toEqual([["a", "b", "c"]]);
    });

    it("Rule 5: Fields with CRLF, comma, or quotes MUST be quoted", () => {
      const data = [["hello,world", 'say "hi"', "line1\r\nline2"]];
      const csv = formatCsv(data);
      expect(csv).toContain('"hello,world"');
      expect(csv).toContain('"say ""hi"""');
      expect(csv).toContain('"line1\r\nline2"');
    });

    it("Rule 6: Quote character is double-quote", () => {
      // Default behavior should use double-quote
      const data = [["test"]];
      const csv = formatCsv(data, { alwaysQuote: true });
      expect(csv).toBe('"test"');
    });

    it("Rule 7: Quotes escaped by doubling", () => {
      const data = [['"quoted"']];
      const csv = formatCsv(data);
      expect(csv).toBe('"""quoted"""');

      // Verify round-trip
      const parsed = parseCsv(csv);
      expect(parsed).toEqual(data);
    });
  });
});
