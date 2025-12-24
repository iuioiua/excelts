import { beforeEach, describe, expect, it } from "vitest";

import { Workbook } from "../../../index";

// Issue 2740: Unable to format a column header definition to be a date format
// The column header should support Date type values, not just strings
describe("github issues", () => {
  describe("issue 2740 - date column headers", () => {
    let workbook: Workbook;

    beforeEach(() => {
      workbook = new Workbook();
    });

    it("should support Date type as column header", async () => {
      const ws = workbook.addWorksheet("Sheet1");
      const dateValue = new Date("2024-02-02");

      ws.columns = [
        { header: dateValue, key: "date1", width: 15, style: { numFmt: "yyyy/mm/dd" } },
        { header: "Name", key: "name", width: 20 }
      ];

      // Add data
      ws.addRow({ date1: new Date("2024-03-15"), name: "Test 1" });

      // Verify header is a Date
      const headerCell = ws.getCell("A1");
      expect(headerCell.value).toBeInstanceOf(Date);
      expect((headerCell.value as Date).toISOString()).toBe("2024-02-02T00:00:00.000Z");
      expect(headerCell.numFmt).toBe("yyyy/mm/dd");

      // Roundtrip test
      const buffer = await workbook.xlsx.writeBuffer();
      const wb2 = new Workbook();
      await wb2.xlsx.load(buffer);

      const ws2 = wb2.getWorksheet("Sheet1");
      const headerCell2 = ws2!.getCell("A1");
      expect(headerCell2.value).toBeInstanceOf(Date);
    });

    it("should support number type as column header", async () => {
      const ws = workbook.addWorksheet("Sheet1");

      ws.columns = [
        { header: 12345, key: "num", width: 15 },
        { header: "Name", key: "name", width: 20 }
      ];

      const headerCell = ws.getCell("A1");
      expect(headerCell.value).toBe(12345);
      expect(typeof headerCell.value).toBe("number");
    });

    it("should support mixed types in multi-row headers", async () => {
      const ws = workbook.addWorksheet("Sheet1");
      const date1 = new Date("2024-01-01");
      const date2 = new Date("2024-01-31");

      ws.columns = [
        { header: [date1, "January"], key: "jan", width: 15 },
        { header: ["Q1", date2], key: "q1", width: 15 }
      ];

      // First column: row 1 = Date, row 2 = string
      expect(ws.getCell("A1").value).toBeInstanceOf(Date);
      expect(ws.getCell("A2").value).toBe("January");

      // Second column: row 1 = string, row 2 = Date
      expect(ws.getCell("B1").value).toBe("Q1");
      expect(ws.getCell("B2").value).toBeInstanceOf(Date);
    });

    it("should apply column style to date headers", async () => {
      const ws = workbook.addWorksheet("Sheet1");

      ws.columns = [
        {
          header: new Date("2024-06-15"),
          key: "date",
          width: 15,
          style: {
            numFmt: "dd-mmm-yyyy",
            font: { bold: true }
          }
        }
      ];

      const headerCell = ws.getCell("A1");
      expect(headerCell.value).toBeInstanceOf(Date);
      expect(headerCell.numFmt).toBe("dd-mmm-yyyy");
      expect(headerCell.font?.bold).toBe(true);
    });
  });
});
