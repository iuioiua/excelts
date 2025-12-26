import { describe, it, expect } from "vitest";
import { Workbook } from "../../index";

describe("Column Page Breaks Integration", () => {
  it("writes and reads column breaks correctly", async () => {
    // Create workbook with column breaks
    const wb1 = new Workbook();
    const ws1 = wb1.addWorksheet("test");

    // Add some data
    for (let col = 1; col <= 10; col++) {
      ws1.getCell(1, col).value = `Header ${col}`;
      ws1.getCell(2, col).value = `Data ${col}`;
    }

    // Add column breaks after columns 3 and 7
    ws1.getColumn(3).addPageBreak();
    ws1.getColumn(7).addPageBreak();

    expect(ws1.colBreaks.length).toBe(2);

    // Write to buffer and read back
    const buffer = await wb1.xlsx.writeBuffer();

    const wb2 = new Workbook();
    await wb2.xlsx.load(buffer);

    const ws2 = wb2.getWorksheet("test");
    expect(ws2).toBeDefined();

    // Note: colBreaks are stored in model but may not be exposed on worksheet
    // after reading. This tests the round-trip capability.
    const model = ws2!.model;
    expect(model.colBreaks).toBeDefined();
    expect(model.colBreaks.length).toBe(2);
    expect(model.colBreaks[0].id).toBe(3);
    expect(model.colBreaks[1].id).toBe(7);
  });

  it("writes and reads row and column breaks together", async () => {
    const wb1 = new Workbook();
    const ws1 = wb1.addWorksheet("mixed");

    // Add data
    for (let row = 1; row <= 5; row++) {
      for (let col = 1; col <= 5; col++) {
        ws1.getCell(row, col).value = `R${row}C${col}`;
      }
    }

    // Add row break after row 2
    ws1.getRow(2).addPageBreak();

    // Add column break after column 3
    ws1.getColumn(3).addPageBreak();

    expect(ws1.rowBreaks.length).toBe(1);
    expect(ws1.colBreaks.length).toBe(1);

    // Write to buffer and read back
    const buffer = await wb1.xlsx.writeBuffer();

    const wb2 = new Workbook();
    await wb2.xlsx.load(buffer);

    const ws2 = wb2.getWorksheet("mixed");
    const model = ws2!.model;

    expect(model.rowBreaks).toBeDefined();
    expect(model.colBreaks).toBeDefined();
  });
});
