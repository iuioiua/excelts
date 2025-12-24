import { colCache } from "../utils/col-cache";

interface ValidationModel {
  [address: string]: any;
}

class DataValidations {
  model: ValidationModel;

  constructor(model?: ValidationModel) {
    this.model = model || {};
  }

  add(address: string, validation: any): any {
    return (this.model[address] = validation);
  }

  find(address: string): any {
    // First check direct address match
    const direct = this.model[address];
    if (direct !== undefined) {
      return direct;
    }

    // Check range: prefixed keys in model (from parsing large ranges)
    // Only decode address if we have range keys to check
    const keys = Object.keys(this.model);
    const rangeKeys = keys.filter(k => k.startsWith("range:"));
    if (rangeKeys.length === 0) {
      return undefined;
    }

    const decoded = colCache.decodeAddress(address);
    for (const key of rangeKeys) {
      const rangeStr = key.slice(6); // Remove "range:" prefix
      const rangeDecoded = colCache.decodeEx(rangeStr) as any;
      if (rangeDecoded.dimensions) {
        const tl = rangeDecoded.tl as { row: number; col: number };
        const br = rangeDecoded.br as { row: number; col: number };
        if (
          decoded.row >= tl.row &&
          decoded.row <= br.row &&
          decoded.col >= tl.col &&
          decoded.col <= br.col
        ) {
          return this.model[key];
        }
      }
    }

    return undefined;
  }

  remove(address: string): void {
    this.model[address] = undefined;
  }
}

export { DataValidations };
