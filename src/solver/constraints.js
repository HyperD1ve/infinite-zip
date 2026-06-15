/**
 * @import { Clue } from '../types/index.js'
 */
import { assertBoardSize, cellKey, inBounds } from '../game/board.js';

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Clue[]} clues
 */
export function normalizeClues(rows, cols, clues) {
  assertBoardSize(rows, cols);

  if (!Array.isArray(clues) || clues.length < 2) {
    throw new Error('A puzzle needs at least a start and end clue.');
  }

  const sorted = [...clues].sort((a, b) => a.number - b.number);
  const usedCells = new Set();

  sorted.forEach((clue, index) => {
    if (clue.number !== index + 1) {
      throw new Error('Clue numbers must be consecutive starting at 1.');
    }

    if (!inBounds(rows, cols, clue)) {
      throw new Error(`Clue ${clue.number} is outside the board.`);
    }

    const key = cellKey(clue);
    if (usedCells.has(key)) {
      throw new Error(`Multiple clues occupy cell ${key}.`);
    }
    usedCells.add(key);
  });

  return sorted;
}

/**
 * @param {Clue[]} clues
 */
export function buildClueMap(clues) {
  const map = new Map();
  clues.forEach((clue) => {
    map.set(cellKey(clue), clue);
  });
  return map;
}
