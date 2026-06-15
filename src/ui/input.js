import { inBounds } from '../game/board.js';

const ARROW_DELTAS = new Map([
  ['ArrowUp', { row: -1, col: 0 }],
  ['ArrowRight', { row: 0, col: 1 }],
  ['ArrowDown', { row: 1, col: 0 }],
  ['ArrowLeft', { row: 0, col: -1 }],
]);

/**
 * @param {string} key
 */
export function isArrowKey(key) {
  return ARROW_DELTAS.has(key);
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {import('../types/index.js').Cell} current
 * @param {string} key
 */
export function arrowDestination(rows, cols, current, key) {
  const delta = ARROW_DELTAS.get(key);
  if (!delta) {
    return null;
  }

  const next = {
    row: current.row + delta.row,
    col: current.col + delta.col,
  };

  return inBounds(rows, cols, next) ? next : null;
}
