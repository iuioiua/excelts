/**
 * XLSX Browser version - No Node.js dependencies
 * This file is a browser-compatible version of xlsx.ts
 * It removes fs/stream dependencies and only supports load/writeBuffer operations
 */

import type { UnzipFile } from "fflate";
import { Unzip, UnzipInflate } from "fflate";
import { ZipWriter } from "../utils/zip-stream.browser.js";
import { StreamBuf } from "../utils/stream-buf.browser.js";
import { bufferToString } from "../utils/utils.js";
import { XmlStream } from "../utils/xml-stream.js";
import { StylesXform } from "./xform/style/styles-xform.js";
import { CoreXform } from "./xform/core/core-xform.js";
import { SharedStringsXform } from "./xform/strings/shared-strings-xform.js";
import { RelationshipsXform } from "./xform/core/relationships-xform.js";
import { ContentTypesXform } from "./xform/core/content-types-xform.js";
import { AppXform } from "./xform/core/app-xform.js";
import { WorkbookXform } from "./xform/book/workbook-xform.js";
import { WorkSheetXform } from "./xform/sheet/worksheet-xform.js";
import { DrawingXform } from "./xform/drawing/drawing-xform.js";
import { TableXform } from "./xform/table/table-xform.js";
import { PivotCacheRecordsXform } from "./xform/pivot-table/pivot-cache-records-xform.js";
import {
  PivotCacheDefinitionXform,
  type ParsedCacheDefinitionModel
} from "./xform/pivot-table/pivot-cache-definition-xform.js";
import {
  PivotTableXform,
  type ParsedPivotTableModel
} from "./xform/pivot-table/pivot-table-xform.js";
import { CommentsXform } from "./xform/comment/comments-xform.js";
import { VmlNotesXform } from "./xform/comment/vml-notes-xform.js";
import { theme1Xml } from "./xml/theme1.js";
import { RelType } from "./rel-type.js";

// Browser-compatible base64 utilities
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Buffer-like wrapper for Uint8Array with toString("base64") support
class BrowserBuffer extends Uint8Array {
  toString(encoding?: string): string {
    if (encoding === "base64") {
      return uint8ArrayToBase64(this);
    }
    return new TextDecoder().decode(this);
  }

  static from(data: Uint8Array): BrowserBuffer {
    const buffer = new BrowserBuffer(data.length);
    buffer.set(data);
    return buffer;
  }
}

// Simple stream-like wrapper for parsing - implements async iterable
class SimpleStream {
  private data: string | Uint8Array;
  private listeners: Map<string, Function[]> = new Map();
  private ended = false;

  constructor(data: string | Uint8Array) {
    this.data = data;
  }

  // Make it async iterable for parseSax
  async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array | string> {
    yield this.data;
  }

  on(event: string, callback: Function): this {
    const listeners = this.listeners.get(event) || [];
    listeners.push(callback);
    this.listeners.set(event, listeners);

    // If already ended, trigger data and end events immediately
    if (!this.ended) {
      this.ended = true;
      queueMicrotask(() => {
        this.emit("data", this.data);
        this.emit("end");
      });
    }
    return this;
  }

  removeListener(event: string, callback: Function): this {
    const listeners = this.listeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    return this;
  }

  private emit(event: string, ...args: any[]): void {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(cb => cb(...args));
  }

  pipe(dest: StreamBuf): StreamBuf {
    dest.write(this.data instanceof Uint8Array ? this.data : new TextEncoder().encode(this.data));
    dest.end();
    return dest;
  }
}

class XLSX {
  declare public workbook: any;

  constructor(workbook: any) {
    this.workbook = workbook;
  }

  // ===============================================================================
  // Read operations
  // ===============================================================================

  /**
   * Load workbook from buffer/ArrayBuffer/Uint8Array
   * This is the main entry point for browser usage
   */
  async load(data: any, options?: any): Promise<any> {
    let buffer: Uint8Array;

    // Validate input type
    if (
      !data ||
      (typeof data === "object" && !(data instanceof Uint8Array) && !(data instanceof ArrayBuffer))
    ) {
      throw new Error(
        "Can't read the data of 'the loaded zip file'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"
      );
    }

    if (options && options.base64) {
      buffer = base64ToUint8Array(data.toString());
    } else if (data instanceof ArrayBuffer) {
      buffer = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      buffer = data;
    } else {
      // Try to convert to Uint8Array
      buffer = new Uint8Array(data);
    }

    // Use fflate to unzip
    const allFiles: Record<string, Uint8Array> = {};

    await new Promise<void>((resolve, reject) => {
      let filesProcessed = 0;
      let zipEnded = false;
      let filesStarted = 0;

      const checkCompletion = () => {
        if (zipEnded && filesProcessed === filesStarted) {
          resolve();
        }
      };

      const unzipper = new Unzip((file: UnzipFile) => {
        filesStarted++;
        const fileChunks: Uint8Array[] = [];
        let totalLength = 0;

        file.ondata = (err, fileData, final) => {
          if (err) {
            reject(err);
            return;
          }
          if (fileData) {
            fileChunks.push(fileData);
            totalLength += fileData.length;
          }
          if (final) {
            if (fileChunks.length === 1) {
              allFiles[file.name] = fileChunks[0];
            } else if (fileChunks.length > 1) {
              const fullData = new Uint8Array(totalLength);
              let offset = 0;
              for (const chunk of fileChunks) {
                fullData.set(chunk, offset);
                offset += chunk.length;
              }
              allFiles[file.name] = fullData;
            } else {
              allFiles[file.name] = new Uint8Array(0);
            }
            filesProcessed++;
            fileChunks.length = 0;
            checkCompletion();
          }
        };
        file.start();
      });

      unzipper.register(UnzipInflate);
      unzipper.push(buffer, true);
      zipEnded = true;
      checkCompletion();
    });

    return this.loadFromFiles(allFiles, options);
  }

  parseRels(stream: any): Promise<any> {
    const xform = new RelationshipsXform();
    return xform.parseStream(stream);
  }

  parseWorkbook(stream: any): Promise<any> {
    const xform = new WorkbookXform();
    return xform.parseStream(stream);
  }

  parseSharedStrings(stream: any): Promise<any> {
    const xform = new SharedStringsXform();
    return xform.parseStream(stream);
  }

  reconcile(model: any, options?: any): void {
    const workbookXform = new WorkbookXform();
    const worksheetXform = new WorkSheetXform(options);
    const drawingXform = new DrawingXform();
    const tableXform = new TableXform();

    workbookXform.reconcile(model);

    const drawingOptions: any = {
      media: model.media,
      mediaIndex: model.mediaIndex
    };
    Object.keys(model.drawings).forEach(name => {
      const drawing = model.drawings[name];
      const drawingRel = model.drawingRels[name];
      if (drawingRel) {
        drawingOptions.rels = drawingRel.reduce((o: any, rel: any) => {
          o[rel.Id] = rel;
          return o;
        }, {});
        (drawing.anchors || []).forEach((anchor: any) => {
          const hyperlinks = anchor.picture && anchor.picture.hyperlinks;
          if (hyperlinks && drawingOptions.rels[hyperlinks.rId]) {
            hyperlinks.hyperlink = drawingOptions.rels[hyperlinks.rId].Target;
            delete hyperlinks.rId;
          }
        });
        drawingXform.reconcile(drawing, drawingOptions);
      }
    });

    const tableOptions = {
      styles: model.styles
    };
    Object.values(model.tables).forEach((table: any) => {
      tableXform.reconcile(table, tableOptions);
    });

    this._reconcilePivotTables(model);

    const sheetOptions = {
      styles: model.styles,
      sharedStrings: model.sharedStrings,
      media: model.media,
      mediaIndex: model.mediaIndex,
      date1904: model.properties && model.properties.date1904,
      drawings: model.drawings,
      comments: model.comments,
      tables: model.tables,
      vmlDrawings: model.vmlDrawings,
      pivotTables: model.pivotTablesIndexed
    };
    model.worksheets.forEach((worksheet: any) => {
      worksheet.relationships = model.worksheetRels[worksheet.sheetNo];
      worksheetXform.reconcile(worksheet, sheetOptions);
    });

    delete model.worksheetHash;
    delete model.worksheetRels;
    delete model.globalRels;
    delete model.sharedStrings;
    delete model.workbookRels;
    delete model.sheetDefs;
    delete model.styles;
    delete model.mediaIndex;
    delete model.drawings;
    delete model.drawingRels;
    delete model.vmlDrawings;
    delete model.pivotTableRels;
    delete model.pivotCacheDefinitionRels;
  }

  private _reconcilePivotTables(model: any): void {
    const rawPivotTables = model.pivotTables || {};
    if (typeof rawPivotTables !== "object" || Object.keys(rawPivotTables).length === 0) {
      model.pivotTables = [];
      model.pivotTablesIndexed = {};
      return;
    }

    const definitionToCacheId = this._buildDefinitionToCacheIdMap(model);

    const cacheMap = new Map<
      number,
      {
        definition: ParsedCacheDefinitionModel;
        records: any;
        definitionName: string;
      }
    >();

    Object.entries(model.pivotCacheDefinitions || {}).forEach(
      ([name, definition]: [string, any]) => {
        const cacheId = definitionToCacheId.get(name);
        if (cacheId !== undefined) {
          const recordsName = name.replace("Definition", "Records");
          cacheMap.set(cacheId, {
            definition,
            records: model.pivotCacheRecords?.[recordsName],
            definitionName: name
          });
        }
      }
    );

    const loadedPivotTables: any[] = [];
    const pivotTablesIndexed: Record<string, any> = {};

    Object.entries(rawPivotTables).forEach(([pivotName, pivotTable]: [string, any]) => {
      const pt = pivotTable as ParsedPivotTableModel;
      const tableNumber = this._extractTableNumber(pivotName);
      const cacheData = cacheMap.get(pt.cacheId);

      const completePivotTable = {
        ...pt,
        tableNumber,
        cacheDefinition: cacheData?.definition,
        cacheRecords: cacheData?.records,
        cacheFields: cacheData?.definition?.cacheFields || [],
        rows: pt.rowFields.filter(f => f >= 0),
        columns: pt.colFields.filter(f => f >= 0 && f !== -2),
        values: pt.dataFields.map(df => df.fld),
        metric: this._determineMetric(pt.dataFields),
        applyWidthHeightFormats: pt.applyWidthHeightFormats || "0"
      };

      loadedPivotTables.push(completePivotTable);
      pivotTablesIndexed[`../pivotTables/${pivotName}.xml`] = completePivotTable;
    });

    loadedPivotTables.sort((a, b) => a.tableNumber - b.tableNumber);
    model.pivotTables = loadedPivotTables;
    model.pivotTablesIndexed = pivotTablesIndexed;
    model.loadedPivotTables = loadedPivotTables;
  }

  private _extractTableNumber(name: string): number {
    const match = name.match(/pivotTable(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  private _buildCacheIdMap(model: any): Map<string, number> {
    const rIdToCacheId = new Map<string, number>();
    const pivotCaches = model.pivotCaches || [];
    for (const cache of pivotCaches) {
      if (cache.cacheId && cache.rId) {
        rIdToCacheId.set(cache.rId, parseInt(cache.cacheId, 10));
      }
    }
    return rIdToCacheId;
  }

  private _buildDefinitionToCacheIdMap(model: any): Map<string, number> {
    const definitionToCacheId = new Map<string, number>();
    const rIdToCacheId = this._buildCacheIdMap(model);
    const workbookRels = model.workbookRels || [];

    for (const rel of workbookRels) {
      if (rel.Type === XLSX.RelType.PivotCacheDefinition && rel.Target) {
        const match = rel.Target.match(/pivotCacheDefinition(\d+)\.xml/);
        if (match) {
          const defName = `pivotCacheDefinition${match[1]}`;
          const cacheId = rIdToCacheId.get(rel.Id);
          if (cacheId !== undefined) {
            definitionToCacheId.set(defName, cacheId);
          }
        }
      }
    }

    return definitionToCacheId;
  }

  private _determineMetric(dataFields: Array<{ subtotal?: string }>): "sum" | "count" {
    if (dataFields.length > 0 && dataFields[0].subtotal === "count") {
      return "count";
    }
    return "sum";
  }

  async _processWorksheetEntry(
    stream: any,
    model: any,
    sheetNo: number,
    options: any,
    path: string
  ): Promise<void> {
    const xform = new WorkSheetXform(options);
    const worksheet = await xform.parseStream(stream);
    if (!worksheet) {
      throw new Error(`Failed to parse worksheet ${path}`);
    }
    worksheet.sheetNo = sheetNo;
    model.worksheetHash[path] = worksheet;
    model.worksheets.push(worksheet);
  }

  async _processCommentEntry(stream: any, model: any, name: string): Promise<void> {
    const xform = new CommentsXform();
    const comments = await xform.parseStream(stream);
    model.comments[`../${name}.xml`] = comments;
  }

  async _processTableEntry(stream: any, model: any, name: string): Promise<void> {
    const xform = new TableXform();
    const table = await xform.parseStream(stream);
    model.tables[`../tables/${name}.xml`] = table;
  }

  async _processWorksheetRelsEntry(stream: any, model: any, sheetNo: number): Promise<void> {
    const xform = new RelationshipsXform();
    const relationships = await xform.parseStream(stream);
    model.worksheetRels[sheetNo] = relationships;
  }

  async _processMediaEntry(stream: any, model: any, filename: string): Promise<void> {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot >= 1) {
      const extension = filename.substr(lastDot + 1);
      const name = filename.substr(0, lastDot);
      await new Promise<void>((resolve, reject) => {
        const streamBuf = new StreamBuf();

        const cleanup = () => {
          stream.removeListener("error", onError);
          streamBuf.removeListener("error", onError);
          streamBuf.removeListener("finish", onFinish);
        };

        const onFinish = () => {
          cleanup();
          model.mediaIndex[filename] = model.media.length;
          model.mediaIndex[name] = model.media.length;
          const medium = {
            type: "image",
            name,
            extension,
            buffer: streamBuf.toBuffer()
          };
          model.media.push(medium);
          resolve();
        };

        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };

        streamBuf.once("finish", onFinish);
        stream.on("error", onError);
        streamBuf.on("error", onError);
        stream.pipe(streamBuf);
      });
    }
  }

  async _processDrawingEntry(entry: any, model: any, name: string): Promise<void> {
    const xform = new DrawingXform();
    const drawing = await xform.parseStream(entry);
    model.drawings[name] = drawing;
  }

  async _processDrawingRelsEntry(entry: any, model: any, name: string): Promise<void> {
    const xform = new RelationshipsXform();
    const relationships = await xform.parseStream(entry);
    model.drawingRels[name] = relationships;
  }

  async _processVmlDrawingEntry(entry: any, model: any, name: string): Promise<void> {
    const xform = new VmlNotesXform();
    const vmlDrawing = await xform.parseStream(entry);
    model.vmlDrawings[`../drawings/${name}.vml`] = vmlDrawing;
  }

  async _processThemeEntry(stream: any, model: any, name: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const streamBuf = new StreamBuf();

      const cleanup = () => {
        stream.removeListener("error", onError);
        streamBuf.removeListener("error", onError);
        streamBuf.removeListener("finish", onFinish);
      };

      const onFinish = () => {
        cleanup();
        const data = streamBuf.read();
        model.themes[name] = data ? new TextDecoder().decode(data) : "";
        resolve();
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      streamBuf.once("finish", onFinish);
      stream.on("error", onError);
      streamBuf.on("error", onError);
      stream.pipe(streamBuf);
    });
  }

  async _processPivotTableEntry(stream: any, model: any, name: string): Promise<void> {
    const xform = new PivotTableXform();
    const pivotTable = await xform.parseStream(stream);
    if (pivotTable) {
      model.pivotTables[name] = pivotTable;
    }
  }

  async _processPivotTableRelsEntry(stream: any, model: any, name: string): Promise<void> {
    const xform = new RelationshipsXform();
    const relationships = await xform.parseStream(stream);
    model.pivotTableRels[name] = relationships;
  }

  async _processPivotCacheDefinitionEntry(stream: any, model: any, name: string): Promise<void> {
    const xform = new PivotCacheDefinitionXform();
    const cacheDefinition = await xform.parseStream(stream);
    if (cacheDefinition) {
      model.pivotCacheDefinitions[name] = cacheDefinition;
    }
  }

  async _processPivotCacheDefinitionRelsEntry(
    stream: any,
    model: any,
    name: string
  ): Promise<void> {
    const xform = new RelationshipsXform();
    const relationships = await xform.parseStream(stream);
    model.pivotCacheDefinitionRels[name] = relationships;
  }

  async _processPivotCacheRecordsEntry(stream: any, model: any, name: string): Promise<void> {
    const xform = new PivotCacheRecordsXform();
    const cacheRecords = await xform.parseStream(stream);
    if (cacheRecords) {
      model.pivotCacheRecords[name] = cacheRecords;
    }
  }

  async loadFromFiles(zipData: Record<string, Uint8Array>, options?: any): Promise<any> {
    const model: any = {
      worksheets: [],
      worksheetHash: {},
      worksheetRels: [],
      themes: {},
      media: [],
      mediaIndex: {},
      drawings: {},
      drawingRels: {},
      comments: {},
      tables: {},
      vmlDrawings: {},
      pivotTables: {},
      pivotTableRels: {},
      pivotCacheDefinitions: {},
      pivotCacheDefinitionRels: {},
      pivotCacheRecords: {}
    };

    const entries = Object.keys(zipData).map(name => ({
      name,
      dir: name.endsWith("/"),
      data: zipData[name]
    }));

    for (const entry of entries) {
      if (!entry.dir) {
        let entryName = entry.name;
        if (entryName[0] === "/") {
          entryName = entryName.substr(1);
        }

        let stream: SimpleStream;
        if (entryName.match(/xl\/media\//) || entryName.match(/xl\/theme\/([a-zA-Z0-9]+)[.]xml/)) {
          stream = new SimpleStream(entry.data);
        } else {
          const content = bufferToString(entry.data as any);
          stream = new SimpleStream(content);
        }

        let match: RegExpMatchArray | null;
        match = entryName.match(/xl\/worksheets\/sheet(\d+)[.]xml/);
        if (match) {
          const sheetNo = parseInt(match[1], 10);
          await this._processWorksheetEntry(stream, model, sheetNo, options, entryName);
        } else {
          switch (entryName) {
            case "_rels/.rels":
              model.globalRels = await this.parseRels(stream);
              break;
            case "xl/workbook.xml": {
              const workbook = await this.parseWorkbook(stream);
              model.sheets = workbook.sheets;
              model.definedNames = workbook.definedNames;
              model.views = workbook.views;
              model.properties = workbook.properties;
              model.calcProperties = workbook.calcProperties;
              model.pivotCaches = workbook.pivotCaches;
              break;
            }
            case "xl/sharedStrings.xml":
              model.sharedStrings = new SharedStringsXform();
              await model.sharedStrings.parseStream(stream);
              break;
            case "xl/_rels/workbook.xml.rels":
              model.workbookRels = await this.parseRels(stream);
              break;
            case "docProps/app.xml": {
              const appXform = new AppXform();
              const appProperties = await appXform.parseStream(stream);
              model.company = appProperties.company;
              model.manager = appProperties.manager;
              break;
            }
            case "docProps/core.xml": {
              const coreXform = new CoreXform();
              const coreProperties = await coreXform.parseStream(stream);
              Object.assign(model, coreProperties);
              break;
            }
            case "xl/styles.xml":
              model.styles = new StylesXform();
              await model.styles.parseStream(stream);
              break;
            default: {
              match = entryName.match(/xl\/worksheets\/_rels\/sheet(\d+)[.]xml[.]rels/);
              if (match) {
                const sheetNo = parseInt(match[1], 10);
                await this._processWorksheetRelsEntry(stream, model, sheetNo);
                break;
              }
              match = entryName.match(/xl\/media\/([a-zA-Z0-9]+[.][a-zA-Z0-9]{3,4})$/);
              if (match) {
                await this._processMediaEntry(stream, model, match[1]);
                break;
              }
              match = entryName.match(/xl\/drawings\/(drawing\d+)[.]xml/);
              if (match) {
                await this._processDrawingEntry(stream, model, match[1]);
                break;
              }
              match = entryName.match(/xl\/drawings\/_rels\/(drawing\d+)[.]xml[.]rels/);
              if (match) {
                await this._processDrawingRelsEntry(stream, model, match[1]);
                break;
              }
              match = entryName.match(/xl\/drawings\/(vmlDrawing\d+)[.]vml/);
              if (match) {
                await this._processVmlDrawingEntry(stream, model, match[1]);
                break;
              }
              match = entryName.match(/xl\/comments(\d+)[.]xml/);
              if (match) {
                await this._processCommentEntry(stream, model, `comments${match[1]}`);
                break;
              }
              match = entryName.match(/xl\/tables\/(table\d+)[.]xml/);
              if (match) {
                await this._processTableEntry(stream, model, match[1]);
                break;
              }
              match = entryName.match(/xl\/theme\/([a-zA-Z0-9]+)[.]xml/);
              if (match) {
                await this._processThemeEntry(stream, model, match[1]);
                break;
              }
              match = entryName.match(/xl\/pivotTables\/(pivotTable\d+)[.]xml/);
              if (match) {
                await this._processPivotTableEntry(stream, model, match[1]);
                break;
              }
              match = entryName.match(/xl\/pivotTables\/_rels\/(pivotTable\d+)[.]xml[.]rels/);
              if (match) {
                await this._processPivotTableRelsEntry(stream, model, match[1]);
                break;
              }
              match = entryName.match(/xl\/pivotCache\/(pivotCacheDefinition\d+)[.]xml/);
              if (match) {
                await this._processPivotCacheDefinitionEntry(stream, model, match[1]);
                break;
              }
              match = entryName.match(
                /xl\/pivotCache\/_rels\/(pivotCacheDefinition\d+)[.]xml[.]rels/
              );
              if (match) {
                await this._processPivotCacheDefinitionRelsEntry(stream, model, match[1]);
                break;
              }
              match = entryName.match(/xl\/pivotCache\/(pivotCacheRecords\d+)[.]xml/);
              if (match) {
                await this._processPivotCacheRecordsEntry(stream, model, match[1]);
                break;
              }
            }
          }
        }
      }
    }

    this.reconcile(model, options);
    this.workbook.model = model;
    return this.workbook;
  }

  // ===============================================================================
  // Write operations
  // ===============================================================================

  async addContentTypes(zip: any, model: any): Promise<void> {
    const xform = new ContentTypesXform();
    const xml = xform.toXml(model);
    zip.append(xml, { name: "[Content_Types].xml" });
  }

  async addApp(zip: any, model: any): Promise<void> {
    const xform = new AppXform();
    const xml = xform.toXml(model);
    zip.append(xml, { name: "docProps/app.xml" });
  }

  async addCore(zip: any, model: any): Promise<void> {
    const xform = new CoreXform();
    zip.append(xform.toXml(model), { name: "docProps/core.xml" });
  }

  async addThemes(zip: any, model: any): Promise<void> {
    const themes = model.themes || { theme1: theme1Xml };
    Object.keys(themes).forEach(name => {
      const xml = themes[name];
      const path = `xl/theme/${name}.xml`;
      zip.append(xml, { name: path });
    });
  }

  async addOfficeRels(zip: any, _model: any): Promise<void> {
    const xform = new RelationshipsXform();
    const xml = xform.toXml([
      { Id: "rId1", Type: XLSX.RelType.OfficeDocument, Target: "xl/workbook.xml" },
      { Id: "rId2", Type: XLSX.RelType.CoreProperties, Target: "docProps/core.xml" },
      { Id: "rId3", Type: XLSX.RelType.ExtenderProperties, Target: "docProps/app.xml" }
    ]);
    zip.append(xml, { name: "_rels/.rels" });
  }

  async addWorkbookRels(zip: any, model: any): Promise<void> {
    let count = 1;
    const relationships: any[] = [
      { Id: `rId${count++}`, Type: XLSX.RelType.Styles, Target: "styles.xml" },
      { Id: `rId${count++}`, Type: XLSX.RelType.Theme, Target: "theme/theme1.xml" }
    ];
    if (model.sharedStrings.count) {
      relationships.push({
        Id: `rId${count++}`,
        Type: XLSX.RelType.SharedStrings,
        Target: "sharedStrings.xml"
      });
    }
    (model.pivotTables || []).forEach((pivotTable: any) => {
      pivotTable.rId = `rId${count++}`;
      relationships.push({
        Id: pivotTable.rId,
        Type: XLSX.RelType.PivotCacheDefinition,
        Target: `pivotCache/pivotCacheDefinition${pivotTable.tableNumber}.xml`
      });
    });
    model.worksheets.forEach((worksheet: any, index: number) => {
      worksheet.rId = `rId${count++}`;
      worksheet.fileIndex = index + 1;
      relationships.push({
        Id: worksheet.rId,
        Type: XLSX.RelType.Worksheet,
        Target: `worksheets/sheet${worksheet.fileIndex}.xml`
      });
    });
    const xform = new RelationshipsXform();
    const xml = xform.toXml(relationships);
    zip.append(xml, { name: "xl/_rels/workbook.xml.rels" });
  }

  async addSharedStrings(zip: any, model: any): Promise<void> {
    if (model.sharedStrings && model.sharedStrings.count) {
      zip.append(model.sharedStrings.xml, { name: "xl/sharedStrings.xml" });
    }
  }

  async addStyles(zip: any, model: any): Promise<void> {
    const { xml } = model.styles;
    if (xml) {
      zip.append(xml, { name: "xl/styles.xml" });
    }
  }

  async addWorkbook(zip: any, model: any): Promise<void> {
    const xform = new WorkbookXform();
    zip.append(xform.toXml(model), { name: "xl/workbook.xml" });
  }

  async addWorksheets(zip: any, model: any): Promise<void> {
    const worksheetXform = new WorkSheetXform();
    const relationshipsXform = new RelationshipsXform();
    const commentsXform = new CommentsXform();
    const vmlNotesXform = new VmlNotesXform();

    model.worksheets.forEach((worksheet: any, index: number) => {
      const fileIndex = worksheet.fileIndex || index + 1;
      let xmlStream = new XmlStream();
      worksheetXform.render(xmlStream, worksheet);
      zip.append(xmlStream.xml, { name: `xl/worksheets/sheet${fileIndex}.xml` });

      if (worksheet.rels && worksheet.rels.length) {
        xmlStream = new XmlStream();
        relationshipsXform.render(xmlStream, worksheet.rels);
        zip.append(xmlStream.xml, { name: `xl/worksheets/_rels/sheet${fileIndex}.xml.rels` });
      }

      if (worksheet.comments.length > 0) {
        xmlStream = new XmlStream();
        commentsXform.render(xmlStream, worksheet);
        zip.append(xmlStream.xml, { name: `xl/comments${fileIndex}.xml` });

        xmlStream = new XmlStream();
        vmlNotesXform.render(xmlStream, worksheet);
        zip.append(xmlStream.xml, { name: `xl/drawings/vmlDrawing${fileIndex}.vml` });
      }
    });
  }

  async addMedia(zip: any, model: any): Promise<void> {
    await Promise.all(
      model.media.map(async (medium: any) => {
        if (medium.type === "image") {
          const filename = `xl/media/${medium.name}.${medium.extension}`;
          if (medium.buffer) {
            return zip.append(medium.buffer, { name: filename });
          }
          if (medium.base64) {
            const dataimg64 = medium.base64;
            const content = dataimg64.substring(dataimg64.indexOf(",") + 1);
            return zip.append(content, { name: filename, base64: true });
          }
          // In browser, we don't support loading from filename
          throw new Error("Loading images from filename is not supported in browser");
        }
        throw new Error("Unsupported media");
      })
    );
  }

  addDrawings(zip: any, model: any): void {
    const drawingXform = new DrawingXform();
    const relsXform = new RelationshipsXform();

    model.worksheets.forEach((worksheet: any) => {
      const { drawing } = worksheet;
      if (drawing) {
        drawingXform.prepare(drawing);
        let xml = drawingXform.toXml(drawing);
        zip.append(xml, { name: `xl/drawings/${drawing.name}.xml` });

        xml = relsXform.toXml(drawing.rels);
        zip.append(xml, { name: `xl/drawings/_rels/${drawing.name}.xml.rels` });
      }
    });
  }

  addTables(zip: any, model: any): void {
    const tableXform = new TableXform();

    model.worksheets.forEach((worksheet: any) => {
      const { tables } = worksheet;
      tables.forEach((table: any) => {
        tableXform.prepare(table, {});
        const tableXml = tableXform.toXml(table);
        zip.append(tableXml, { name: `xl/tables/${table.target}` });
      });
    });
  }

  addPivotTables(zip: any, model: any): void {
    if (!model.pivotTables.length) {
      return;
    }

    const pivotCacheRecordsXform = new PivotCacheRecordsXform();
    const pivotCacheDefinitionXform = new PivotCacheDefinitionXform();
    const pivotTableXform = new PivotTableXform();
    const relsXform = new RelationshipsXform();

    model.pivotTables.forEach((pivotTable: any) => {
      const n = pivotTable.tableNumber;
      const isLoaded = pivotTable.isLoaded;

      if (isLoaded) {
        if (pivotTable.cacheDefinition) {
          const xml = pivotCacheDefinitionXform.toXml(pivotTable.cacheDefinition);
          zip.append(xml, { name: `xl/pivotCache/pivotCacheDefinition${n}.xml` });
        }
        if (pivotTable.cacheRecords) {
          const xml = pivotCacheRecordsXform.toXml(pivotTable.cacheRecords);
          zip.append(xml, { name: `xl/pivotCache/pivotCacheRecords${n}.xml` });
        }
      } else {
        let xml = pivotCacheRecordsXform.toXml(pivotTable);
        zip.append(xml, { name: `xl/pivotCache/pivotCacheRecords${n}.xml` });

        xml = pivotCacheDefinitionXform.toXml(pivotTable);
        zip.append(xml, { name: `xl/pivotCache/pivotCacheDefinition${n}.xml` });
      }

      let xml = relsXform.toXml([
        {
          Id: "rId1",
          Type: XLSX.RelType.PivotCacheRecords,
          Target: `pivotCacheRecords${n}.xml`
        }
      ]);
      zip.append(xml, { name: `xl/pivotCache/_rels/pivotCacheDefinition${n}.xml.rels` });

      xml = pivotTableXform.toXml(pivotTable);
      zip.append(xml, { name: `xl/pivotTables/pivotTable${n}.xml` });

      xml = relsXform.toXml([
        {
          Id: "rId1",
          Type: XLSX.RelType.PivotCacheDefinition,
          Target: `../pivotCache/pivotCacheDefinition${n}.xml`
        }
      ]);
      zip.append(xml, { name: `xl/pivotTables/_rels/pivotTable${n}.xml.rels` });
    });
  }

  _finalize(zip: any): Promise<XLSX> {
    return new Promise((resolve, reject) => {
      zip.on("finish", () => {
        resolve(this);
      });
      zip.on("error", reject);
      zip.finalize();
    });
  }

  prepareModel(model: any, options: any): void {
    model.creator = model.creator || "ExcelTS";
    model.lastModifiedBy = model.lastModifiedBy || "ExcelTS";
    model.created = model.created || new Date();
    model.modified = model.modified || new Date();

    model.useSharedStrings =
      options.useSharedStrings !== undefined ? options.useSharedStrings : true;
    model.useStyles = options.useStyles !== undefined ? options.useStyles : true;

    model.sharedStrings = new SharedStringsXform();
    model.styles = model.useStyles ? new StylesXform(true) : new (StylesXform as any).Mock();

    const workbookXform = new WorkbookXform();
    const worksheetXform = new WorkSheetXform();

    workbookXform.prepare(model);

    const worksheetOptions: any = {
      sharedStrings: model.sharedStrings,
      styles: model.styles,
      date1904: model.properties.date1904,
      drawingsCount: 0,
      media: model.media
    };
    worksheetOptions.drawings = model.drawings = [];
    worksheetOptions.commentRefs = model.commentRefs = [];
    let tableCount = 0;
    model.tables = [];
    model.worksheets.forEach((worksheet: any) => {
      worksheet.tables.forEach((table: any) => {
        tableCount++;
        table.target = `table${tableCount}.xml`;
        table.id = tableCount;
        model.tables.push(table);
      });

      worksheetXform.prepare(worksheet, worksheetOptions);
    });
  }

  async write(stream: StreamBuf, options?: any): Promise<XLSX> {
    options = options || {};
    const { model } = this.workbook;
    const zip = new ZipWriter(options.zip);
    zip.pipe(stream);

    this.prepareModel(model, options);

    await this.addContentTypes(zip, model);
    await this.addOfficeRels(zip, model);
    await this.addWorkbookRels(zip, model);
    await this.addWorksheets(zip, model);
    await this.addSharedStrings(zip, model);
    this.addDrawings(zip, model);
    this.addTables(zip, model);
    this.addPivotTables(zip, model);
    await Promise.all([this.addThemes(zip, model), this.addStyles(zip, model)]);
    await this.addMedia(zip, model);
    await Promise.all([this.addApp(zip, model), this.addCore(zip, model)]);
    await this.addWorkbook(zip, model);
    return this._finalize(zip);
  }

  /**
   * Write workbook to buffer - main method for browser usage
   * Returns a BrowserBuffer which supports toString("base64")
   */
  async writeBuffer(options?: any): Promise<BrowserBuffer> {
    const stream = new StreamBuf();
    await this.write(stream, options);
    return BrowserBuffer.from(stream.read());
  }

  static RelType = RelType;
}

export { XLSX };
