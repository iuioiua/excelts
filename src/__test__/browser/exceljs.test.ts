import { describe, it, expect } from "vitest";

declare const ExcelTS: {
  Workbook: any;
};

describe("ExcelTS Browser Tests", () => {
  it("should read and write xlsx via binary buffer", async () => {
    const { Workbook } = ExcelTS;
    const wb = new Workbook();
    const ws = wb.addWorksheet("blort");

    ws.getCell("A1").value = "Hello, World!";
    ws.getCell("A2").value = 7;

    const buffer = await wb.xlsx.writeBuffer();

    const wb2 = new Workbook();
    await wb2.xlsx.load(buffer);

    const ws2 = wb2.getWorksheet("blort");
    expect(ws2).toBeTruthy();
    expect(ws2!.getCell("A1").value).toEqual("Hello, World!");
    expect(ws2!.getCell("A2").value).toEqual(7);
  });

  it("should read and write xlsx via base64 buffer", async () => {
    const { Workbook } = ExcelTS;
    const options = {
      base64: true
    };
    const wb = new Workbook();
    const ws = wb.addWorksheet("blort");

    ws.getCell("A1").value = "Hello, World!";
    ws.getCell("A2").value = 7;

    const buffer = await wb.xlsx.writeBuffer(options);

    const wb2 = new Workbook();
    await wb2.xlsx.load(buffer.toString("base64"), options);

    const ws2 = wb2.getWorksheet("blort");
    expect(ws2).toBeTruthy();
    expect(ws2!.getCell("A1").value).toEqual("Hello, World!");
    expect(ws2!.getCell("A2").value).toEqual(7);
  });

  // Skip CSV test - CSV support requires Node.js 'fast-csv' module which is not available in browser
  it.skip("should write csv via buffer (Node.js only)", async () => {
    const { Workbook } = ExcelTS;
    const wb = new Workbook();
    const ws = wb.addWorksheet("blort");

    ws.getCell("A1").value = "Hello, World!";
    ws.getCell("B1").value = "What time is it?";
    ws.getCell("A2").value = 7;
    ws.getCell("B2").value = "12pm";

    const buffer = await wb.csv.writeBuffer();

    expect(buffer.toString()).toEqual('"Hello, World!",What time is it?\n7,12pm');
  });

  // Test crypto polyfill - worksheet protection uses crypto.randomBytes and crypto.createHash
  it("should support worksheet protection with password (crypto polyfill)", async () => {
    const { Workbook } = ExcelTS;
    const wb = new Workbook();
    const ws = wb.addWorksheet("protected");

    ws.getCell("A1").value = "Protected Data";

    // This uses crypto.randomBytes() and crypto.createHash() internally
    await ws.protect("password123", { sheet: true });

    expect(ws.sheetProtection).toBeTruthy();
    expect(ws.sheetProtection.sheet).toBe(true);
    expect(ws.sheetProtection.algorithmName).toBe("SHA-512");
    expect(ws.sheetProtection.saltValue).toBeTruthy();
    expect(ws.sheetProtection.hashValue).toBeTruthy();
    expect(ws.sheetProtection.spinCount).toBe(100000);

    // Verify we can write and read back the protected workbook
    const buffer = await wb.xlsx.writeBuffer();
    const wb2 = new Workbook();
    await wb2.xlsx.load(buffer);

    const ws2 = wb2.getWorksheet("protected");
    expect(ws2).toBeTruthy();
    expect(ws2!.sheetProtection).toBeTruthy();
    expect(ws2!.sheetProtection.sheet).toBe(true);
  });
});
