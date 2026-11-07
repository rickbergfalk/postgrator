import fs from "fs";
import crypto from "crypto";
import type { Migration } from "../types.js";

export function sortMigrationsAsc(a: Migration, b: Migration): number {
  if (a.version < b.version) {
    return -1;
  }
  if (a.version > b.version) {
    return 1;
  }
  return 0;
}

export function sortMigrationsDesc(a: Migration, b: Migration): number {
  if (a.version < b.version) {
    return 1;
  }
  if (a.version > b.version) {
    return -1;
  }
  return 0;
}

/**
 * Calculate checksum of file to detect changes to migrations that have already run.
 * @param filename
 * @param lineEnding - newline setting string for newline lib
 */
export function fileChecksum(filename: string, lineEnding?: string): string {
  const content = fs.readFileSync(filename, "utf8");
  return checksum(content, lineEnding);
}

/**
 * Calculate checksum of content.
 * @param content - Content to checksum
 * @param lineEnding - newline setting string for newline lib
 */
export function checksum(content: string, lineEnding?: string): string {
  if (lineEnding) {
    content = convertLineEnding(content, lineEnding);
  }
  return crypto.createHash("md5").update(content, "utf8").digest("hex");
}

export function convertLineEnding(content: string, lineEnding: string): string {
  const lineEndingMap: Record<string, string> = {
    LF: "\n",
    CR: "\r",
    CRLF: "\r\n",
  };
  if (!lineEndingMap[lineEnding]) {
    throw new Error(
      `newline must be one of: ${Object.keys(lineEndingMap).join(", ")}`
    );
  }
  return content.replace(/\r\n|\r|\n/g, lineEndingMap[lineEnding]);
}

export default {
  fileChecksum,
  sortMigrationsAsc,
  sortMigrationsDesc,
  convertLineEnding,
};
