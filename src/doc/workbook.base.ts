/**
 * WorkbookBase - Platform-independent base class for Workbook
 *
 * This file contains all the shared logic between Node.js and Browser versions.
 * Platform-specific features (xlsx, csv, streaming) are added by subclasses.
 */

import { Worksheet, type WorksheetModel } from "./worksheet.js";
import { DefinedNames, type DefinedNameModel } from "./defined-names.js";
import type { PivotTable } from "./pivot-table.js";
import type {
  AddWorksheetOptions,
  CalculationProperties,
  Image,
  WorkbookProperties,
  WorkbookView,
  Buffer as ExcelBuffer
} from "../types.js";

// =============================================================================
// Internal Types
// =============================================================================

/** Internal media type - more flexible than public Media type */
export interface WorkbookMedia {
  type: string;
  extension: string;
  filename?: string;
  buffer?: ExcelBuffer | Uint8Array;
  base64?: string;
  name?: string;
}

/** Internal model type for serialization */
export interface WorkbookModel {
  creator?: string;
  lastModifiedBy?: string;
  lastPrinted?: Date;
  created: Date;
  modified: Date;
  properties: Partial<WorkbookProperties>;
  worksheets: WorksheetModel[];
  sheets?: WorksheetModel[];
  definedNames: DefinedNameModel[];
  views: WorkbookView[];
  company: string;
  manager: string;
  title: string;
  subject: string;
  keywords: string;
  category: string;
  description: string;
  language?: string;
  revision?: number;
  contentStatus?: string;
  themes?: unknown;
  media: WorkbookMedia[];
  pivotTables: PivotTable[];
  /** Loaded pivot tables from file - used during reconciliation */
  loadedPivotTables?: any[];
  calcProperties: Partial<CalculationProperties>;
}

// =============================================================================
// WorkbookBase Class
// =============================================================================

/**
 * Base class for Workbook containing all platform-independent functionality.
 *
 * Subclasses add:
 * - Node.js: xlsx (full), csv, streaming (createStreamWriter/Reader)
 * - Browser: xlsx (buffer only), no csv, no streaming
 */
export abstract class WorkbookBase {
  // Metadata
  declare public category: string;
  declare public company: string;
  declare public created: Date;
  declare public description: string;
  declare public keywords: string;
  declare public manager: string;
  declare public modified: Date;
  declare public subject: string;
  declare public title: string;
  declare public creator?: string;
  declare public lastModifiedBy?: string;
  declare public lastPrinted?: Date;
  declare public language?: string;
  declare public revision?: number;
  declare public contentStatus?: string;

  // Properties
  declare public properties: Partial<WorkbookProperties>;
  declare public calcProperties: Partial<CalculationProperties>;
  declare public views: WorkbookView[];
  declare public media: WorkbookMedia[];
  declare public pivotTables: PivotTable[];

  // Internal
  declare protected _worksheets: Worksheet[];
  declare protected _definedNames: DefinedNames;
  declare protected _themes?: unknown;

  constructor() {
    this.category = "";
    this.company = "";
    this.created = new Date();
    this.description = "";
    this.keywords = "";
    this.manager = "";
    this.modified = this.created;
    this.properties = {};
    this.calcProperties = {};
    this._worksheets = [];
    this.subject = "";
    this.title = "";
    this.views = [];
    this.media = [];
    this.pivotTables = [];
    this._definedNames = new DefinedNames();
  }

  // ===========================================================================
  // Worksheet Management
  // ===========================================================================

  get nextId(): number {
    // Find the next unique spot to add worksheet
    for (let i = 1; i < this._worksheets.length; i++) {
      if (!this._worksheets[i]) {
        return i;
      }
    }
    return this._worksheets.length || 1;
  }

  /**
   * Add a new worksheet and return a reference to it
   */
  addWorksheet(name?: string, options?: AddWorksheetOptions): Worksheet {
    const id = this.nextId;

    const lastOrderNo = this._worksheets.reduce(
      (acc, ws) => ((ws && ws.orderNo) > acc ? ws.orderNo : acc),
      0
    );
    const worksheetOptions = {
      ...options,
      id,
      name,
      orderNo: lastOrderNo + 1,
      workbook: this as any
    };

    const worksheet = new Worksheet(worksheetOptions);

    this._worksheets[id] = worksheet;
    return worksheet;
  }

  removeWorksheetEx(worksheet: Worksheet): void {
    delete this._worksheets[worksheet.id];
  }

  removeWorksheet(id: number | string): void {
    const worksheet = this.getWorksheet(id);
    if (worksheet) {
      worksheet.destroy();
    }
  }

  /**
   * Fetch sheet by name or id
   */
  getWorksheet(id?: number | string): Worksheet | undefined {
    if (id === undefined) {
      return this._worksheets.find(Boolean);
    }
    if (typeof id === "number") {
      return this._worksheets[id];
    }
    if (typeof id === "string") {
      return this._worksheets.find(worksheet => worksheet && worksheet.name === id);
    }
    return undefined;
  }

  /**
   * Return a clone of worksheets in order
   */
  get worksheets(): Worksheet[] {
    return this._worksheets
      .slice(1)
      .sort((a, b) => a.orderNo - b.orderNo)
      .filter(Boolean);
  }

  /**
   * Iterate over all sheets.
   *
   * Note: `workbook.worksheets.forEach` will still work but this is better.
   */
  eachSheet(callback: (sheet: Worksheet, id: number) => void): void {
    this.worksheets.forEach(sheet => {
      callback(sheet, sheet.id);
    });
  }

  // ===========================================================================
  // Defined Names
  // ===========================================================================

  get definedNames(): DefinedNames {
    return this._definedNames;
  }

  // ===========================================================================
  // Themes
  // ===========================================================================

  clearThemes(): void {
    // Note: themes are not an exposed feature, meddle at your peril!
    this._themes = undefined;
  }

  // ===========================================================================
  // Images
  // ===========================================================================

  /**
   * Add Image to Workbook and return the id
   */
  addImage(image: Image): number {
    const id = this.media.length;
    this.media.push({ ...image, type: "image" });
    return id;
  }

  getImage(id: number | string): WorkbookMedia | undefined {
    return this.media[Number(id)];
  }

  // ===========================================================================
  // Model (Serialization)
  // ===========================================================================

  get model(): WorkbookModel {
    return {
      creator: this.creator || "Unknown",
      lastModifiedBy: this.lastModifiedBy || "Unknown",
      lastPrinted: this.lastPrinted,
      created: this.created,
      modified: this.modified,
      properties: this.properties,
      worksheets: this.worksheets.map(worksheet => worksheet.model),
      sheets: this.worksheets.map(ws => ws.model).filter(Boolean),
      definedNames: this._definedNames.model,
      views: this.views,
      company: this.company,
      manager: this.manager,
      title: this.title,
      subject: this.subject,
      keywords: this.keywords,
      category: this.category,
      description: this.description,
      language: this.language,
      revision: this.revision,
      contentStatus: this.contentStatus,
      themes: this._themes,
      media: this.media,
      pivotTables: this.pivotTables,
      calcProperties: this.calcProperties
    };
  }

  set model(value: WorkbookModel) {
    this.creator = value.creator;
    this.lastModifiedBy = value.lastModifiedBy;
    this.lastPrinted = value.lastPrinted;
    this.created = value.created;
    this.modified = value.modified;
    this.company = value.company;
    this.manager = value.manager;
    this.title = value.title;
    this.subject = value.subject;
    this.keywords = value.keywords;
    this.category = value.category;
    this.description = value.description;
    this.language = value.language;
    this.revision = value.revision;
    this.contentStatus = value.contentStatus;

    this.properties = value.properties;
    this.calcProperties = value.calcProperties;
    this._worksheets = [];
    value.worksheets.forEach(worksheetModel => {
      const { id, name, state } = worksheetModel;
      const orderNo = value.sheets && value.sheets.findIndex(ws => ws.id === id);
      const worksheet = (this._worksheets[id] = new Worksheet({
        id,
        name,
        orderNo: orderNo !== -1 ? orderNo : undefined,
        state,
        workbook: this as any
      }));
      worksheet.model = worksheetModel;
    });

    this._definedNames.model = value.definedNames;
    this.views = value.views;
    this._themes = value.themes;
    this.media = value.media || [];

    // Handle pivot tables - either newly created or loaded from file
    // Loaded pivot tables come from loadedPivotTables after reconciliation
    this.pivotTables = value.pivotTables || value.loadedPivotTables || [];
  }
}
