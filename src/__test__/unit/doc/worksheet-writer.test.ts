import { describe, it, expect } from "vitest";
import { WorksheetWriter } from "../../../stream/xlsx/worksheet-writer";
import { StreamBuf } from "../../../utils/stream-buf";

describe("Worksheet Writer", () => {
  it("generates valid xml even when there is no data", () =>
    // issue: https://github.com/guyonroche/exceljs/issues/99
    // PR: https://github.com/guyonroche/exceljs/pull/255
    new Promise((resolve, reject) => {
      const mockWorkbook: any = {
        _openStream() {
          return this.stream;
        },
        stream: new StreamBuf()
      };
      mockWorkbook.stream.on("finish", () => {
        try {
          const xml = mockWorkbook.stream.read().toString();
          // Basic XML validation: check for proper opening/closing tags
          expect(xml).toContain("<?xml");
          expect(xml).toContain("</worksheet>");
          resolve(undefined);
        } catch (error) {
          reject(error);
        }
      });

      const writer = new WorksheetWriter({
        id: 1,
        workbook: mockWorkbook
      });

      writer.commit();
    }));

  it("writes sheetProtection before autoFilter in XML output", () =>
    // issue: https://github.com/exceljs/exceljs/pull/2685
    // When both autoFilter and sheetProtection are set, sheetProtection must come first
    // in the XML output for Excel to open the file correctly.
    new Promise((resolve, reject) => {
      const mockWorkbook: any = {
        _openStream() {
          return this.stream;
        },
        stream: new StreamBuf()
      };
      mockWorkbook.stream.on("finish", () => {
        try {
          const xml = mockWorkbook.stream.read().toString();

          // Both elements should be present
          expect(xml).toContain("<sheetProtection");
          expect(xml).toContain("<autoFilter");

          // sheetProtection must come before autoFilter
          const protectionIndex = xml.indexOf("<sheetProtection");
          const autoFilterIndex = xml.indexOf("<autoFilter");
          expect(protectionIndex).toBeLessThan(autoFilterIndex);

          resolve(undefined);
        } catch (error) {
          reject(error);
        }
      });

      const writer = new WorksheetWriter({
        id: 1,
        workbook: mockWorkbook
      });

      // Set autoFilter
      writer.autoFilter = { from: "A1", to: "C1" };

      // Set sheet protection (no password, no data needed)
      writer.protect("", {});

      writer.commit();
    }));
});
