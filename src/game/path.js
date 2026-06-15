/**
 * @import { SolutionPath } from '../types/index.js'
 */
import { cellKey, validateSolutionPath } from './board.js';

/**
 * @param {number} rows
 * @param {number} cols
 * @param {SolutionPath} path
 */
export function assertValidSolutionPath(rows, cols, path) {
  const validation = validateSolutionPath(rows, cols, path);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }
}

/**
 * @param {SolutionPath} path
 */
export function pathIndexByCell(path) {
  const index = new Map();
  path.forEach((cell, position) => {
    index.set(cellKey(cell), position);
  });
  return index;
}
