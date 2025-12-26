import fs from "fs";
import { Zip, ZipDeflate } from "../../utils/zip/streaming-zip";
import { StreamBuf } from "../../utils/stream-buf";
import { RelType } from "../../xlsx/rel-type";
import { StylesXform } from "../../xlsx/xform/style/styles-xform";
import { SharedStrings } from "../../utils/shared-strings";
import { DefinedNames } from "../../doc/defined-names";
import { CoreXform } from "../../xlsx/xform/core/core-xform";
import { RelationshipsXform } from "../../xlsx/xform/core/relationships-xform";
import { ContentTypesXform } from "../../xlsx/xform/core/content-types-xform";
import { AppXform } from "../../xlsx/xform/core/app-xform";
import { WorkbookXform } from "../../xlsx/xform/book/workbook-xform";
import { SharedStringsXform } from "../../xlsx/xform/strings/shared-strings-xform";
import { WorksheetWriter } from "./worksheet-writer";
import { theme1Xml } from "../../xlsx/xml/theme1";
import type Stream from "stream";
import type { Image, WorkbookView, AddWorksheetOptions } from "../../types";

/** Internal medium type for storing images in workbook */
interface Medium extends Image {
  type: "image";
  name: string;
}

/** Internal comment reference type for tracking comment files */
interface CommentRef {
  commentName: string;
  vmlDrawing: string;
}

export interface ZlibOptions {
  /** @default constants.Z_NO_FLUSH */
  flush?: number;
  /** @default constants.Z_FINISH */
  finishFlush?: number;
  /** @default 16*1024 */
  chunkSize?: number;
  windowBits?: number;
  /** compression level (0-9) */
  level?: number;
  memLevel?: number;
  strategy?: number;
  dictionary?: Buffer | NodeJS.TypedArray | DataView | ArrayBuffer;
}

export interface ZipOptions {
  comment?: string;
  forceLocalTime?: boolean;
  forceZip64?: boolean;
  store?: boolean;
  zlib?: Partial<ZlibOptions>;
  /** Alternative way to set compression level */
  compressionOptions?: {
    level?: number;
  };
}

export interface WorkbookWriterOptions {
  /** The date the workbook was created */
  created?: Date;
  /** The date the workbook was last modified */
  modified?: Date;
  /** The author of the workbook */
  creator?: string;
  /** Who last modified the workbook */
  lastModifiedBy?: string;
  /** The date the workbook was last printed */
  lastPrinted?: Date;
  /** Specifies whether to use shared strings in the workbook. Default is false */
  useSharedStrings?: boolean;
  /** Specifies whether to add style information to the workbook. Default is false */
  useStyles?: boolean;
  /** Zip compression options */
  zip?: Partial<ZipOptions>;
  /** Specifies a writable stream to write the XLSX workbook to */
  stream?: Stream;
  /** If stream not specified, this field specifies the path to a file to write the XLSX workbook to */
  filename?: string;
}

class WorkbookWriter {
  /** The date the workbook was created */
  created: Date;
  /** The date the workbook was last modified */
  modified: Date;
  /** The author of the workbook */
  creator: string;
  /** Who last modified the workbook */
  lastModifiedBy: string;
  /** The date the workbook was last printed */
  lastPrinted?: Date;
  /** Whether to use shared strings */
  useSharedStrings: boolean;
  /** Shared strings collection - internal use */
  sharedStrings: SharedStrings;
  /** Style manager - internal use */
  styles: StylesXform;
  /** Defined names - internal use */
  _definedNames: DefinedNames;
  /** Worksheets collection */
  _worksheets: WorksheetWriter[];
  /** Workbook views controls how many separate windows Excel will open */
  views: WorkbookView[];
  /** Zip options - internal use */
  zipOptions?: Partial<ZipOptions>;
  /** Compression level (0-9) */
  compressionLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** Media collection (images) - internal use */
  media: Medium[];
  /** Comment references - internal use */
  commentRefs: CommentRef[];
  /** Zip instance - internal use */
  zip: Zip;
  /** Output stream - internal use */
  stream: Stream | fs.WriteStream | InstanceType<typeof StreamBuf>;
  /** Internal promise for async operations */
  promise: Promise<void[]>;

  constructor(options: WorkbookWriterOptions = {}) {
    this.created = options.created || new Date();
    this.modified = options.modified || this.created;
    this.creator = options.creator || "ExcelTS";
    this.lastModifiedBy = options.lastModifiedBy || "ExcelTS";
    this.lastPrinted = options.lastPrinted;

    // using shared strings creates a smaller xlsx file but may use more memory
    this.useSharedStrings = options.useSharedStrings || false;
    this.sharedStrings = new SharedStrings();

    // style manager
    this.styles = options.useStyles ? new StylesXform(true) : new (StylesXform as any).Mock(true);

    // defined names
    this._definedNames = new DefinedNames();

    this._worksheets = [];
    this.views = [];

    this.zipOptions = options.zip;
    // Extract compression level from zip options (supports both zlib.level and compressionOptions.level)
    // Default compression level is 1 (fast compression with good ratio)
    // Level 1 is ~2x faster than level 6 with only ~7% larger files
    const level = options.zip?.zlib?.level ?? options.zip?.compressionOptions?.level ?? 1;
    this.compressionLevel = Math.max(0, Math.min(9, level)) as
      | 0
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6
      | 7
      | 8
      | 9;

    this.media = [];
    this.commentRefs = [];

    // Create fflate Zip instance
    this.zip = new Zip((err, data, final) => {
      if (err) {
        this.stream.emit("error", err);
      } else {
        this.stream.write(Buffer.from(data));
        if (final) {
          this.stream.end();
        }
      }
    });

    if (options.stream) {
      this.stream = options.stream;
    } else if (options.filename) {
      this.stream = fs.createWriteStream(options.filename);
    } else {
      this.stream = new StreamBuf();
    }

    // these bits can be added right now
    this.promise = Promise.all([this.addThemes(), this.addOfficeRels()]);
  }

  get definedNames(): DefinedNames {
    return this._definedNames;
  }

  _openStream(path: string): InstanceType<typeof StreamBuf> {
    const stream = new StreamBuf({ bufSize: 65536, batch: true });

    // Create a ZipDeflate for this file with compression
    const zipFile = new ZipDeflate(path, { level: this.compressionLevel });
    this.zip.add(zipFile);

    // Don't pause the stream - we need data events to flow
    // The original implementation used archiver which consumed the stream internally
    // Now we need to manually pipe data to fflate

    // Pipe stream data to zipFile with cleanup
    const onData = (chunk: Buffer) => {
      zipFile.push(chunk);
    };

    stream.on("data", onData);

    // Use once for automatic cleanup and also clean up data listener
    stream.once("finish", () => {
      stream.removeListener("data", onData);
      zipFile.push(new Uint8Array(0), true); // Signal end
      stream.emit("zipped");
    });

    return stream;
  }

  _addFile(data: string | Uint8Array, name: string, base64?: boolean): void {
    // Helper method to add a file to the zip using fflate with compression
    const zipFile = new ZipDeflate(name, { level: this.compressionLevel });
    this.zip.add(zipFile);

    let buffer: Uint8Array;
    if (base64) {
      // Use Buffer.from for efficient base64 decoding
      const base64Data = typeof data === "string" ? data : new TextDecoder().decode(data);
      buffer = Buffer.from(base64Data, "base64");
    } else if (typeof data === "string") {
      buffer = Buffer.from(data, "utf8");
    } else {
      buffer = data;
    }

    zipFile.push(buffer, true); // true = final chunk
  }

  _commitWorksheets(): Promise<void> {
    const commitWorksheet = function (worksheet: any): Promise<void> {
      if (!worksheet.committed) {
        return new Promise(resolve => {
          // Use once to automatically clean up listener
          worksheet.stream.once("zipped", () => {
            resolve();
          });
          worksheet.commit();
        });
      }
      return Promise.resolve();
    };
    // if there are any uncommitted worksheets, commit them now and wait
    const promises = this._worksheets.map(commitWorksheet);
    if (promises.length) {
      return Promise.all(promises).then(() => {});
    }
    return Promise.resolve();
  }

  async commit(): Promise<void> {
    // commit all worksheets, then add supplementary files
    await this.promise;
    await this._commitWorksheets();
    await this.addMedia();
    await Promise.all([
      this.addContentTypes(),
      this.addApp(),
      this.addCore(),
      this.addSharedStrings(),
      this.addStyles(),
      this.addWorkbookRels()
    ]);
    await this.addWorkbook();
    return this._finalize();
  }

  get nextId(): number {
    // find the next unique spot to add worksheet
    let i;
    for (i = 1; i < this._worksheets.length; i++) {
      if (!this._worksheets[i]) {
        return i;
      }
    }
    return this._worksheets.length || 1;
  }

  /**
   * Add Image to Workbook and return the id
   */
  addImage(image: Image): number {
    const id = this.media.length;
    const medium: Medium = {
      ...image,
      type: "image" as const,
      name: `image${id}.${image.extension}`
    };
    this.media.push(medium);
    return id;
  }

  /**
   * Get image by id
   */
  getImage(id: number): Image | undefined {
    return this.media[id];
  }

  /**
   * Add a new worksheet and return a reference to it
   */
  addWorksheet(name?: string, options?: Partial<AddWorksheetOptions>): WorksheetWriter {
    // it's possible to add a worksheet with different than default
    // shared string handling
    // in fact, it's even possible to switch it mid-sheet
    const opts = options || {};
    const useSharedStrings =
      opts.useSharedStrings !== undefined ? opts.useSharedStrings : this.useSharedStrings;

    if ((opts as any).tabColor) {
      console.trace("tabColor option has moved to { properties: tabColor: {...} }");
      opts.properties = Object.assign(
        {
          tabColor: (opts as any).tabColor
        },
        opts.properties
      );
    }

    const id = this.nextId;
    name = name || `sheet${id}`;

    const worksheet = new WorksheetWriter({
      id,
      name,
      workbook: this,
      useSharedStrings,
      properties: opts.properties,
      state: opts.state,
      pageSetup: opts.pageSetup,
      views: opts.views,
      autoFilter: opts.autoFilter,
      headerFooter: opts.headerFooter
    });

    this._worksheets[id] = worksheet;
    return worksheet;
  }

  /**
   * Fetch sheet by name or id
   */
  getWorksheet(id?: string | number): WorksheetWriter | undefined {
    if (id === undefined) {
      return this._worksheets.find(() => true);
    }
    if (typeof id === "number") {
      return this._worksheets[id];
    }
    if (typeof id === "string") {
      return this._worksheets.find(worksheet => worksheet && worksheet.name === id);
    }
    return undefined;
  }

  addStyles(): Promise<void> {
    return new Promise(resolve => {
      this._addFile(this.styles.xml, "xl/styles.xml");
      resolve();
    });
  }

  addThemes(): Promise<void> {
    return new Promise(resolve => {
      this._addFile(theme1Xml, "xl/theme/theme1.xml");
      resolve();
    });
  }

  addOfficeRels(): Promise<void> {
    return new Promise(resolve => {
      const xform = new RelationshipsXform();
      const xml = xform.toXml([
        { Id: "rId1", Type: RelType.OfficeDocument, Target: "xl/workbook.xml" },
        { Id: "rId2", Type: RelType.CoreProperties, Target: "docProps/core.xml" },
        { Id: "rId3", Type: RelType.ExtenderProperties, Target: "docProps/app.xml" }
      ]);
      this._addFile(xml, "_rels/.rels");
      resolve();
    });
  }

  addContentTypes(): Promise<void> {
    return new Promise(resolve => {
      const model = {
        worksheets: this._worksheets.filter(Boolean),
        sharedStrings: this.sharedStrings,
        commentRefs: this.commentRefs,
        media: this.media
      };
      const xform = new ContentTypesXform();
      const xml = xform.toXml(model);
      this._addFile(xml, "[Content_Types].xml");
      resolve();
    });
  }

  addMedia(): Promise<void[]> {
    return Promise.all(
      this.media.map(async medium => {
        if (medium.type === "image") {
          const filename = `xl/media/${medium.name}`;
          if (medium.filename) {
            const data = await new Promise<Uint8Array>((resolve, reject) => {
              fs.readFile(medium.filename, (err, data) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(new Uint8Array(data));
                }
              });
            });
            this._addFile(data, filename);
            return;
          }
          if (medium.buffer) {
            this._addFile(medium.buffer, filename);
            return;
          }
          if (medium.base64) {
            const dataimg64 = medium.base64;
            const content = dataimg64.substring(dataimg64.indexOf(",") + 1);
            this._addFile(content, filename, true);
            return;
          }
        }
        throw new Error("Unsupported media");
      })
    );
  }

  addApp(): Promise<void> {
    return new Promise(resolve => {
      const model = {
        worksheets: this._worksheets.filter(Boolean)
      };
      const xform = new AppXform();
      const xml = xform.toXml(model);
      this._addFile(xml, "docProps/app.xml");
      resolve();
    });
  }

  addCore(): Promise<void> {
    return new Promise(resolve => {
      const coreXform = new CoreXform();
      const xml = coreXform.toXml(this);
      this._addFile(xml, "docProps/core.xml");
      resolve();
    });
  }

  addSharedStrings(): Promise<void> {
    if (this.sharedStrings.count) {
      return new Promise(resolve => {
        const sharedStringsXform = new SharedStringsXform();
        const xml = sharedStringsXform.toXml(this.sharedStrings);
        this._addFile(xml, "xl/sharedStrings.xml");
        resolve();
      });
    }
    return Promise.resolve();
  }

  addWorkbookRels(): Promise<void> {
    let count = 1;
    const relationships = [
      { Id: `rId${count++}`, Type: RelType.Styles, Target: "styles.xml" },
      { Id: `rId${count++}`, Type: RelType.Theme, Target: "theme/theme1.xml" }
    ];
    if (this.sharedStrings.count) {
      relationships.push({
        Id: `rId${count++}`,
        Type: RelType.SharedStrings,
        Target: "sharedStrings.xml"
      });
    }
    this._worksheets.forEach(worksheet => {
      if (worksheet) {
        worksheet.rId = `rId${count++}`;
        relationships.push({
          Id: worksheet.rId,
          Type: RelType.Worksheet,
          Target: `worksheets/sheet${worksheet.id}.xml`
        });
      }
    });
    return new Promise(resolve => {
      const xform = new RelationshipsXform();
      const xml = xform.toXml(relationships);
      this._addFile(xml, "xl/_rels/workbook.xml.rels");
      resolve();
    });
  }

  addWorkbook(): Promise<void> {
    const model = {
      worksheets: this._worksheets.filter(Boolean),
      definedNames: this._definedNames.model,
      views: this.views,
      properties: {},
      calcProperties: {}
    };

    return new Promise(resolve => {
      const xform = new WorkbookXform();
      xform.prepare(model);
      this._addFile(xform.toXml(model), "xl/workbook.xml");
      resolve();
    });
  }

  _finalize(): Promise<any> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error) => {
        this.stream.removeListener("finish", onFinish);
        reject(err);
      };

      const onFinish = () => {
        this.stream.removeListener("error", onError);
        resolve(this);
      };

      this.stream.once("error", onError);
      this.stream.once("finish", onFinish);

      // fflate Zip doesn't have 'error' event or 'finalize' method
      // Just end the zip by calling end()
      this.zip.end();
    });
  }
}

export { WorkbookWriter };
