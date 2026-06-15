import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string[]} columns
 */
export function toCsv(rows, columns) {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(',')),
  ].join('\n');
}

/**
 * @param {string} filePath
 * @param {Record<string, unknown>[]} rows
 * @param {string[]} columns
 */
export function writeCsv(filePath, rows, columns) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${toCsv(rows, columns)}\n`);
}

/**
 * @param {unknown} value
 */
function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = typeof value === 'number' && Number.isFinite(value)
    ? formatNumber(value)
    : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

/**
 * @param {number} value
 */
function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(6);
}
