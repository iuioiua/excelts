import { describe, it, expect } from "vitest";
import {
  parseDate,
  formatDate,
  mightBeDate,
  getSupportedFormats,
  DateParser,
  DateFormatter
} from "../../../utils/datetime";

describe("datetime", () => {
  describe("parseDate", () => {
    describe("ISO 8601 with timezone", () => {
      it("parses ISO date with Z timezone", () => {
        const result = parseDate("2024-12-26T10:30:00Z");
        expect(result).toBeInstanceOf(Date);
        expect(result!.toISOString()).toBe("2024-12-26T10:30:00.000Z");
      });

      it("parses ISO date with positive timezone offset", () => {
        const result = parseDate("2024-12-26T18:30:00+08:00");
        expect(result).toBeInstanceOf(Date);
        expect(result!.toISOString()).toBe("2024-12-26T10:30:00.000Z");
      });

      it("parses ISO date with negative timezone offset", () => {
        const result = parseDate("2024-12-26T05:30:00-05:00");
        expect(result).toBeInstanceOf(Date);
        expect(result!.toISOString()).toBe("2024-12-26T10:30:00.000Z");
      });
    });

    describe("ISO 8601 without timezone", () => {
      it("parses ISO datetime without timezone", () => {
        const result = parseDate("2024-12-26T10:30:00");
        expect(result).toBeInstanceOf(Date);
        expect(result!.getFullYear()).toBe(2024);
        expect(result!.getMonth()).toBe(11);
        expect(result!.getDate()).toBe(26);
        expect(result!.getHours()).toBe(10);
        expect(result!.getMinutes()).toBe(30);
        expect(result!.getSeconds()).toBe(0);
      });
    });

    describe("ISO date only", () => {
      it("parses YYYY-MM-DD format", () => {
        const result = parseDate("2024-12-26");
        expect(result).toBeInstanceOf(Date);
        expect(result!.getFullYear()).toBe(2024);
        expect(result!.getMonth()).toBe(11);
        expect(result!.getDate()).toBe(26);
      });

      it("rejects invalid dates", () => {
        expect(parseDate("2024-02-30")).toBeNull();
        expect(parseDate("2024-13-01")).toBeNull();
        expect(parseDate("2024-00-01")).toBeNull();
      });
    });

    describe("US format (MM-DD-YYYY)", () => {
      it("parses MM-DD-YYYY format", () => {
        const result = parseDate("12-26-2024", ["MM-DD-YYYY"]);
        expect(result).toBeInstanceOf(Date);
        expect(result!.getFullYear()).toBe(2024);
        expect(result!.getMonth()).toBe(11);
        expect(result!.getDate()).toBe(26);
      });

      it("parses MM/DD/YYYY format", () => {
        const result = parseDate("12/26/2024", ["MM-DD-YYYY"]);
        expect(result).toBeInstanceOf(Date);
        expect(result!.getFullYear()).toBe(2024);
        expect(result!.getMonth()).toBe(11);
        expect(result!.getDate()).toBe(26);
      });

      it("rejects invalid US dates", () => {
        expect(parseDate("02-30-2024", ["MM-DD-YYYY"])).toBeNull();
        expect(parseDate("13-01-2024", ["MM-DD-YYYY"])).toBeNull();
      });
    });

    describe("European format (DD-MM-YYYY)", () => {
      it("parses DD-MM-YYYY format", () => {
        const result = parseDate("26-12-2024", ["DD-MM-YYYY"]);
        expect(result).toBeInstanceOf(Date);
        expect(result!.getFullYear()).toBe(2024);
        expect(result!.getMonth()).toBe(11);
        expect(result!.getDate()).toBe(26);
      });

      it("parses DD/MM/YYYY format", () => {
        const result = parseDate("26/12/2024", ["DD-MM-YYYY"]);
        expect(result).toBeInstanceOf(Date);
        expect(result!.getFullYear()).toBe(2024);
        expect(result!.getMonth()).toBe(11);
        expect(result!.getDate()).toBe(26);
      });
    });

    describe("Datetime with space", () => {
      it("parses YYYY-MM-DD HH:mm:ss format", () => {
        const result = parseDate("2024-12-26 10:30:45");
        expect(result).toBeInstanceOf(Date);
        expect(result!.getFullYear()).toBe(2024);
        expect(result!.getMonth()).toBe(11);
        expect(result!.getDate()).toBe(26);
        expect(result!.getHours()).toBe(10);
        expect(result!.getMinutes()).toBe(30);
        expect(result!.getSeconds()).toBe(45);
      });
    });

    describe("ISO with milliseconds", () => {
      it("parses ISO datetime with milliseconds and Z", () => {
        const result = parseDate("2024-12-26T10:30:00.123Z");
        expect(result).toBeInstanceOf(Date);
        expect(result!.toISOString()).toBe("2024-12-26T10:30:00.123Z");
      });

      it("parses ISO datetime with milliseconds and timezone", () => {
        const result = parseDate("2024-12-26T18:30:00.500+08:00");
        expect(result).toBeInstanceOf(Date);
        expect(result!.toISOString()).toBe("2024-12-26T10:30:00.500Z");
      });
    });

    describe("format priority", () => {
      it("respects format order when specified", () => {
        const usResult = parseDate("01-02-2024", ["MM-DD-YYYY"]);
        expect(usResult!.getMonth()).toBe(0); // January
        expect(usResult!.getDate()).toBe(2);

        const euResult = parseDate("01-02-2024", ["DD-MM-YYYY"]);
        expect(euResult!.getMonth()).toBe(1); // February
        expect(euResult!.getDate()).toBe(1);
      });
    });

    describe("edge cases", () => {
      it("returns null for empty string", () => {
        expect(parseDate("")).toBeNull();
      });

      it("returns null for null/undefined", () => {
        expect(parseDate(null as any)).toBeNull();
        expect(parseDate(undefined as any)).toBeNull();
      });

      it("returns null for non-date strings", () => {
        expect(parseDate("hello")).toBeNull();
        expect(parseDate("12345")).toBeNull();
        expect(parseDate("abc-def-ghij")).toBeNull();
      });

      it("handles whitespace", () => {
        const result = parseDate("  2024-12-26  ");
        expect(result).toBeInstanceOf(Date);
        expect(result!.getFullYear()).toBe(2024);
      });

      it("returns null for unsupported format when formats specified", () => {
        expect(parseDate("2024-12-26", ["MM-DD-YYYY"])).toBeNull();
      });
    });
  });

  describe("formatDate", () => {
    const testDate = new Date(Date.UTC(2024, 11, 26, 10, 30, 45, 123));

    describe("default format", () => {
      it("formats to ISO with local timezone by default", () => {
        const result = formatDate(testDate);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
      });

      it("formats to ISO with Z for UTC", () => {
        const result = formatDate(testDate, undefined, true);
        expect(result).toBe("2024-12-26T10:30:45.123Z");
      });
    });

    describe("custom formats", () => {
      it("formats YYYY-MM-DD", () => {
        const result = formatDate(testDate, "YYYY-MM-DD", true);
        expect(result).toBe("2024-12-26");
      });

      it("formats YYYY-MM-DD[T]HH:mm:ss", () => {
        const result = formatDate(testDate, "YYYY-MM-DD[T]HH:mm:ss", true);
        expect(result).toBe("2024-12-26T10:30:45");
      });

      it("formats MM/DD/YYYY", () => {
        const result = formatDate(testDate, "MM/DD/YYYY", true);
        expect(result).toBe("12/26/2024");
      });

      it("formats DD-MM-YYYY HH:mm", () => {
        const result = formatDate(testDate, "DD-MM-YYYY HH:mm", true);
        expect(result).toBe("26-12-2024 10:30");
      });

      it("formats with milliseconds", () => {
        const result = formatDate(testDate, "YYYY-MM-DD[T]HH:mm:ss.SSS", true);
        expect(result).toBe("2024-12-26T10:30:45.123");
      });

      it("preserves literal text in brackets", () => {
        const result = formatDate(testDate, "[Date: ]YYYY-MM-DD", true);
        expect(result).toBe("Date: 2024-12-26");
      });
    });

    describe("local vs UTC", () => {
      it("uses local time when utc=false", () => {
        const localDate = new Date(2024, 11, 26, 15, 30, 0);
        const result = formatDate(localDate, "HH:mm", false);
        expect(result).toBe("15:30");
      });

      it("uses UTC time when utc=true", () => {
        const result = formatDate(testDate, "HH:mm:ss", true);
        expect(result).toBe("10:30:45");
      });
    });

    describe("edge cases", () => {
      it("returns empty string for invalid date", () => {
        expect(formatDate(new Date("invalid"))).toBe("");
      });

      it("returns empty string for non-Date input", () => {
        expect(formatDate("2024-12-26" as any)).toBe("");
        expect(formatDate(null as any)).toBe("");
      });
    });
  });

  describe("DateParser", () => {
    it("creates a reusable parser with specified formats", () => {
      const parser = DateParser.create(["YYYY-MM-DD", "MM-DD-YYYY"]);
      expect(parser.parse("2024-12-26")).toBeInstanceOf(Date);
      expect(parser.parse("12-26-2024")).toBeInstanceOf(Date);
      expect(parser.parse("26-12-2024")).toBeNull();
    });

    it("creates ISO auto-detect parser", () => {
      const parser = DateParser.iso();
      expect(parser.parse("2024-12-26")).toBeInstanceOf(Date);
      expect(parser.parse("2024-12-26T10:30:00Z")).toBeInstanceOf(Date);
      expect(parser.parse("2024-12-26 10:30:00")).toBeInstanceOf(Date);
    });

    it("parses all values in batch", () => {
      const parser = DateParser.create(["YYYY-MM-DD"]);
      const results = parser.parseAll(["2024-01-01", "invalid", "2024-12-31"]);
      expect(results[0]).toBeInstanceOf(Date);
      expect(results[1]).toBeNull();
      expect(results[2]).toBeInstanceOf(Date);
    });

    it("filters valid dates", () => {
      const parser = DateParser.create(["YYYY-MM-DD"]);
      const results = parser.parseValid(["2024-01-01", "invalid", "2024-12-31"]);
      expect(results.length).toBe(2);
      expect(results.every(d => d instanceof Date)).toBe(true);
    });
  });

  describe("DateFormatter", () => {
    it("creates ISO formatter", () => {
      const formatter = DateFormatter.iso(true);
      const date = new Date(Date.UTC(2024, 11, 26, 10, 30, 45));
      expect(formatter.format(date)).toBe("2024-12-26T10:30:45.000Z");
    });

    it("creates custom format formatter", () => {
      const formatter = DateFormatter.create("YYYY-MM-DD", { utc: true });
      const date = new Date(Date.UTC(2024, 11, 26));
      expect(formatter.format(date)).toBe("2024-12-26");
    });

    it("formats all dates in batch", () => {
      const formatter = DateFormatter.create("MM/DD/YYYY", { utc: true });
      const dates = [
        new Date(Date.UTC(2024, 0, 1)),
        new Date(Date.UTC(2024, 5, 15)),
        new Date(Date.UTC(2024, 11, 31))
      ];
      const results = formatter.formatAll(dates);
      expect(results).toEqual(["01/01/2024", "06/15/2024", "12/31/2024"]);
    });

    it("handles invalid date in formatter", () => {
      const formatter = DateFormatter.create("YYYY-MM-DD", { utc: true });
      expect(formatter.format(new Date("invalid"))).toBe("");
    });
  });

  describe("mightBeDate", () => {
    it("returns true for date-like strings", () => {
      expect(mightBeDate("2024-12-26")).toBe(true);
      expect(mightBeDate("2024-12-26T10:30:00")).toBe(true);
      expect(mightBeDate("12/26/2024")).toBe(true);
    });

    it("returns false for non-date strings", () => {
      expect(mightBeDate("")).toBe(false);
      expect(mightBeDate("hello")).toBe(false);
      expect(mightBeDate("12345")).toBe(false);
      expect(mightBeDate("short")).toBe(false);
    });

    it("returns false for strings that are too short or too long", () => {
      expect(mightBeDate("2024")).toBe(false);
      expect(mightBeDate("a".repeat(35) + "2024-01-01")).toBe(false);
    });
  });

  describe("getSupportedFormats", () => {
    it("returns array of supported format strings", () => {
      const formats = getSupportedFormats();
      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      expect(formats).toContain("YYYY-MM-DD");
      expect(formats).toContain("YYYY-MM-DD[T]HH:mm:ssZ");
    });
  });

  describe("edge cases - leap year", () => {
    it("accepts Feb 29 on leap years", () => {
      expect(parseDate("2024-02-29")).toBeInstanceOf(Date);
      expect(parseDate("2000-02-29")).toBeInstanceOf(Date);
      expect(parseDate("2020-02-29")).toBeInstanceOf(Date);
    });

    it("rejects Feb 29 on non-leap years", () => {
      expect(parseDate("2023-02-29")).toBeNull();
      expect(parseDate("2100-02-29")).toBeNull();
      expect(parseDate("1900-02-29")).toBeNull();
    });
  });

  describe("edge cases - year boundaries", () => {
    it("handles standard years", () => {
      expect(parseDate("0001-01-01")).toBeInstanceOf(Date);
      expect(parseDate("9999-12-31")).toBeInstanceOf(Date);
    });

    it("handles Unix epoch", () => {
      const epoch = parseDate("1970-01-01T00:00:00Z");
      expect(epoch).toBeInstanceOf(Date);
      expect(epoch!.getTime()).toBe(0);
    });

    it("handles far future dates", () => {
      const future = parseDate("2099-12-31");
      expect(future).toBeInstanceOf(Date);
      expect(future!.getFullYear()).toBe(2099);
    });
  });

  describe("edge cases - time boundaries", () => {
    it("handles midnight (00:00:00)", () => {
      const midnight = parseDate("2024-12-26T00:00:00Z");
      expect(midnight).toBeInstanceOf(Date);
      expect(midnight!.getUTCHours()).toBe(0);
      expect(midnight!.getUTCMinutes()).toBe(0);
      expect(midnight!.getUTCSeconds()).toBe(0);
    });

    it("handles end of day (23:59:59)", () => {
      const endOfDay = parseDate("2024-12-26T23:59:59Z");
      expect(endOfDay).toBeInstanceOf(Date);
      expect(endOfDay!.getUTCHours()).toBe(23);
      expect(endOfDay!.getUTCMinutes()).toBe(59);
      expect(endOfDay!.getUTCSeconds()).toBe(59);
    });

    it("handles max milliseconds", () => {
      const maxMs = parseDate("2024-12-26T10:30:00.999Z");
      expect(maxMs).toBeInstanceOf(Date);
      expect(maxMs!.getUTCMilliseconds()).toBe(999);
    });
  });

  describe("edge cases - timezone extremes", () => {
    it("handles maximum positive timezone offset (+14:00)", () => {
      const result = parseDate("2024-12-26T10:30:00+14:00");
      expect(result).toBeInstanceOf(Date);
      expect(result!.toISOString()).toBe("2024-12-25T20:30:00.000Z");
    });

    it("handles maximum negative timezone offset (-12:00)", () => {
      const result = parseDate("2024-12-26T10:30:00-12:00");
      expect(result).toBeInstanceOf(Date);
      expect(result!.toISOString()).toBe("2024-12-26T22:30:00.000Z");
    });

    it("handles zero offset (+00:00)", () => {
      const result = parseDate("2024-12-26T10:30:00+00:00");
      expect(result).toBeInstanceOf(Date);
      expect(result!.toISOString()).toBe("2024-12-26T10:30:00.000Z");
    });
  });

  describe("edge cases - malformed input", () => {
    it("rejects single-digit month/day (strict parsing)", () => {
      expect(parseDate("2024-1-01")).toBeNull();
      expect(parseDate("2024-01-1")).toBeNull();
      expect(parseDate("2024-1-1")).toBeNull();
    });

    it("rejects dates with extra characters", () => {
      expect(parseDate("2024-12-26extra")).toBeNull();
      expect(parseDate("prefix2024-12-26")).toBeNull();
    });

    it("rejects partial dates", () => {
      expect(parseDate("2024-12")).toBeNull();
      expect(parseDate("2024")).toBeNull();
    });

    it("handles Number input gracefully", () => {
      expect(parseDate(12345 as any)).toBeNull();
      expect(parseDate(0 as any)).toBeNull();
    });

    it("handles object input gracefully", () => {
      expect(parseDate({} as any)).toBeNull();
      expect(parseDate([] as any)).toBeNull();
    });
  });

  describe("edge cases - month boundaries", () => {
    it("handles last day of each month correctly", () => {
      expect(parseDate("2024-01-31")).toBeInstanceOf(Date);
      expect(parseDate("2024-02-29")).toBeInstanceOf(Date);
      expect(parseDate("2024-03-31")).toBeInstanceOf(Date);
      expect(parseDate("2024-04-30")).toBeInstanceOf(Date);
      expect(parseDate("2024-06-30")).toBeInstanceOf(Date);
      expect(parseDate("2024-09-30")).toBeInstanceOf(Date);
      expect(parseDate("2024-11-30")).toBeInstanceOf(Date);
      expect(parseDate("2024-12-31")).toBeInstanceOf(Date);
    });

    it("rejects invalid last days", () => {
      expect(parseDate("2024-02-30")).toBeNull();
      expect(parseDate("2024-04-31")).toBeNull();
      expect(parseDate("2024-06-31")).toBeNull();
      expect(parseDate("2024-09-31")).toBeNull();
      expect(parseDate("2024-11-31")).toBeNull();
    });
  });

  describe("edge cases - formatting", () => {
    it("handles multiple escaped brackets", () => {
      const date = new Date(Date.UTC(2024, 11, 26, 10, 30, 45));
      const result = formatDate(date, "[Date: ]YYYY-MM-DD[, Time: ]HH:mm:ss", true);
      expect(result).toBe("Date: 2024-12-26, Time: 10:30:45");
    });

    it("handles nested brackets content", () => {
      const date = new Date(Date.UTC(2024, 11, 26));
      const result = formatDate(date, "[Today is ]DD/MM/YYYY[!]", true);
      expect(result).toBe("Today is 26/12/2024!");
    });

    it("handles empty brackets", () => {
      const date = new Date(Date.UTC(2024, 11, 26));
      const result = formatDate(date, "YYYY[]MM[]DD", true);
      expect(result).toBe("20241226");
    });

    it("formats single-digit values with padding", () => {
      const date = new Date(Date.UTC(2024, 0, 5, 3, 7, 9, 42));
      const result = formatDate(date, "YYYY-MM-DD HH:mm:ss.SSS", true);
      expect(result).toBe("2024-01-05 03:07:09.042");
    });
  });

  describe("performance", () => {
    it("handles large batches efficiently", () => {
      const parser = DateParser.create(["YYYY-MM-DD"]);
      const formatter = DateFormatter.create("YYYY-MM-DD", { utc: true });

      const dateStrings: string[] = [];
      for (let i = 0; i < 10000; i++) {
        const month = String((i % 12) + 1).padStart(2, "0");
        const day = String((i % 28) + 1).padStart(2, "0");
        dateStrings.push(`2024-${month}-${day}`);
      }

      const start = performance.now();
      const dates = parser.parseAll(dateStrings);
      const formatted = formatter.formatAll(dates.filter((d): d is Date => d !== null));
      const elapsed = performance.now() - start;

      expect(dates.length).toBe(10000);
      expect(formatted.length).toBe(10000);
      // Should complete in reasonable time (less than 100ms for 10000 items)
      expect(elapsed).toBeLessThan(100);
    });
  });
});
