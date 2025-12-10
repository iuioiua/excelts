/**
 * Simple ZIP extraction utilities
 * Provides easy-to-use Promise-based API for extracting ZIP files
 */

import { Readable } from "stream";
import { createParse, type ZipEntry } from "./parse.js";

/**
 * Extracted file entry
 */
export interface ExtractedFile {
  /** File path within the ZIP */
  path: string;
  /** File content as Buffer */
  data: Buffer;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Uncompressed size */
  size: number;
}

/**
 * Extract all files from a ZIP buffer
 *
 * @param zipData - ZIP file data as Buffer or Uint8Array
 * @returns Map of file paths to their content
 *
 * @example
 * ```ts
 * import { extractAll } from "./utils/unzip/extract.js";
 *
 * const zipData = fs.readFileSync("archive.zip");
 * const files = await extractAll(zipData);
 *
 * for (const [path, file] of files) {
 *   console.log(`${path}: ${file.data.length} bytes`);
 * }
 * ```
 */
export async function extractAll(
  zipData: Buffer | Uint8Array
): Promise<Map<string, ExtractedFile>> {
  const files = new Map<string, ExtractedFile>();
  const buffer = Buffer.isBuffer(zipData) ? zipData : Buffer.from(zipData);

  const parse = createParse({ forceStream: true });
  const stream = Readable.from([buffer]);

  stream.pipe(parse);

  for await (const entry of parse) {
    const zipEntry = entry as ZipEntry;
    const isDirectory = zipEntry.type === "Directory";

    if (isDirectory) {
      files.set(zipEntry.path, {
        path: zipEntry.path,
        data: Buffer.alloc(0),
        isDirectory: true,
        size: 0
      });
      zipEntry.autodrain();
    } else {
      const data = await zipEntry.buffer();
      files.set(zipEntry.path, {
        path: zipEntry.path,
        data,
        isDirectory: false,
        size: data.length
      });
    }
  }

  return files;
}

/**
 * Extract a single file from a ZIP buffer
 *
 * @param zipData - ZIP file data as Buffer or Uint8Array
 * @param filePath - Path of the file to extract
 * @returns File content as Buffer, or null if not found
 *
 * @example
 * ```ts
 * import { extractFile } from "./utils/unzip/extract.js";
 *
 * const zipData = fs.readFileSync("archive.zip");
 * const content = await extractFile(zipData, "readme.txt");
 * if (content) {
 *   console.log(content.toString("utf-8"));
 * }
 * ```
 */
export async function extractFile(
  zipData: Buffer | Uint8Array,
  filePath: string
): Promise<Buffer | null> {
  const buffer = Buffer.isBuffer(zipData) ? zipData : Buffer.from(zipData);
  const parse = createParse({ forceStream: true });
  const stream = Readable.from([buffer]);

  stream.pipe(parse);

  for await (const entry of parse) {
    const zipEntry = entry as ZipEntry;

    if (zipEntry.path === filePath) {
      if (zipEntry.type === "Directory") {
        return Buffer.alloc(0);
      }
      return zipEntry.buffer();
    }

    zipEntry.autodrain();
  }

  return null;
}

/**
 * List all file paths in a ZIP buffer (without extracting content)
 *
 * @param zipData - ZIP file data as Buffer or Uint8Array
 * @returns Array of file paths
 *
 * @example
 * ```ts
 * import { listFiles } from "./utils/unzip/extract.js";
 *
 * const zipData = fs.readFileSync("archive.zip");
 * const paths = await listFiles(zipData);
 * console.log(paths); // ["file1.txt", "folder/file2.txt", ...]
 * ```
 */
export async function listFiles(zipData: Buffer | Uint8Array): Promise<string[]> {
  const paths: string[] = [];
  const buffer = Buffer.isBuffer(zipData) ? zipData : Buffer.from(zipData);
  const parse = createParse({ forceStream: true });
  const stream = Readable.from([buffer]);

  stream.pipe(parse);

  for await (const entry of parse) {
    const zipEntry = entry as ZipEntry;
    paths.push(zipEntry.path);
    zipEntry.autodrain();
  }

  return paths;
}

/**
 * Iterate over ZIP entries with a callback (memory efficient for large ZIPs)
 *
 * @param zipData - ZIP file data as Buffer or Uint8Array
 * @param callback - Async callback for each entry, return false to stop iteration
 *
 * @example
 * ```ts
 * import { forEachEntry } from "./utils/unzip/extract.js";
 *
 * await forEachEntry(zipData, async (path, getData) => {
 *   if (path.endsWith(".xml")) {
 *     const content = await getData();
 *     console.log(content.toString("utf-8"));
 *   }
 *   return true; // continue iteration
 * });
 * ```
 */
export async function forEachEntry(
  zipData: Buffer | Uint8Array,
  callback: (
    path: string,
    getData: () => Promise<Buffer>,
    entry: ZipEntry
  ) => Promise<boolean | void>
): Promise<void> {
  const buffer = Buffer.isBuffer(zipData) ? zipData : Buffer.from(zipData);
  const parse = createParse({ forceStream: true });
  const stream = Readable.from([buffer]);

  stream.pipe(parse);

  for await (const entry of parse) {
    const zipEntry = entry as ZipEntry;

    let dataPromise: Promise<Buffer> | null = null;
    const getData = () => {
      if (!dataPromise) {
        dataPromise = zipEntry.buffer();
      }
      return dataPromise;
    };

    const shouldContinue = await callback(zipEntry.path, getData, zipEntry);

    // If callback didn't read data, drain it
    if (!dataPromise) {
      zipEntry.autodrain();
    }

    if (shouldContinue === false) {
      break;
    }
  }
}
