/**
 * @import { Cell, SolutionPath, Wall } from '../types/index.js'
 */

export const MIN_SIZE = 3;
export const MAX_SIZE = 9;

/**
 * @param {number} rows
 * @param {number} cols
 */
export function assertBoardSize(rows, cols) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols)) {
    throw new Error('Rows and columns must be whole numbers.');
  }

  if (rows < MIN_SIZE || cols < MIN_SIZE || rows > MAX_SIZE || cols > MAX_SIZE) {
    throw new Error(`Board size must be between ${MIN_SIZE} and ${MAX_SIZE}.`);
  }
}

/**
 * @param {Cell} cell
 */
export function cellKey(cell) {
  return `${cell.row},${cell.col}`;
}

/**
 * @param {Cell} a
 * @param {Cell} b
 */
export function sameCell(a, b) {
  return a.row === b.row && a.col === b.col;
}

/**
 * @param {Cell} a
 * @param {Cell} b
 */
export function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/**
 * @param {Cell} a
 * @param {Cell} b
 */
export function areAdjacent(a, b) {
  return manhattan(a, b) === 1;
}

/**
 * @param {Cell} a
 * @param {Cell} b
 */
export function wallKey(a, b) {
  const keys = [cellKey(a), cellKey(b)].sort();
  return `${keys[0]}|${keys[1]}`;
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} cell
 */
export function inBounds(rows, cols, cell) {
  return cell.row >= 0 && cell.row < rows && cell.col >= 0 && cell.col < cols;
}

/**
 * @param {number} rows
 * @param {number} cols
 */
export function allCells(rows, cols) {
  assertBoardSize(rows, cols);

  /** @type {Cell[]} */
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({ row, col });
    }
  }
  return cells;
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} cell
 */
export function neighbors(rows, cols, cell) {
  return [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
    { row: cell.row, col: cell.col + 1 },
  ].filter((candidate) => inBounds(rows, cols, candidate));
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Wall[]} walls
 * @returns {Wall[]}
 */
export function normalizeWalls(rows, cols, walls = []) {
  assertBoardSize(rows, cols);

  if (!Array.isArray(walls)) {
    throw new Error('Walls must be a list.');
  }

  const seen = new Set();
  return walls.map((wall) => {
    if (!wall?.a || !wall?.b) {
      throw new Error('Each wall must have two cells.');
    }

    if (!inBounds(rows, cols, wall.a) || !inBounds(rows, cols, wall.b)) {
      throw new Error('Walls must stay inside the board.');
    }

    if (!areAdjacent(wall.a, wall.b)) {
      throw new Error('A wall must sit between adjacent cells.');
    }

    const key = wallKey(wall.a, wall.b);
    if (seen.has(key)) {
      throw new Error('Duplicate walls are not allowed.');
    }
    seen.add(key);

    return {
      a: { row: wall.a.row, col: wall.a.col },
      b: { row: wall.b.row, col: wall.b.col },
    };
  });
}

/**
 * @param {Wall[]} walls
 */
export function buildWallSet(walls = []) {
  return new Set(walls.map((wall) => wallKey(wall.a, wall.b)));
}

/**
 * @param {Set<string>} wallSet
 * @param {Cell} a
 * @param {Cell} b
 */
export function hasWallBetween(wallSet, a, b) {
  return wallSet.has(wallKey(a, b));
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} cell
 * @param {Set<string>} wallSet
 */
export function passableNeighbors(rows, cols, cell, wallSet = new Set()) {
  return neighbors(rows, cols, cell).filter((candidate) => !hasWallBetween(wallSet, cell, candidate));
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {SolutionPath} path
 * @param {Wall[]} walls
 */
export function validateSolutionPath(rows, cols, path, walls = []) {
  assertBoardSize(rows, cols);
  const wallSet = buildWallSet(normalizeWalls(rows, cols, walls));

  const expectedLength = rows * cols;
  if (path.length !== expectedLength) {
    return { valid: false, reason: `Expected ${expectedLength} cells but got ${path.length}.` };
  }

  const seen = new Set();
  for (let index = 0; index < path.length; index += 1) {
    const cell = path[index];
    if (!inBounds(rows, cols, cell)) {
      return { valid: false, reason: `Cell ${index + 1} is outside the board.` };
    }

    const key = cellKey(cell);
    if (seen.has(key)) {
      return { valid: false, reason: `Cell ${key} is visited more than once.` };
    }
    seen.add(key);

    if (index > 0 && !areAdjacent(path[index - 1], cell)) {
      return { valid: false, reason: `Cells ${index} and ${index + 1} are not adjacent.` };
    }

    if (index > 0 && hasWallBetween(wallSet, path[index - 1], cell)) {
      return { valid: false, reason: `Cells ${index} and ${index + 1} are separated by a wall.` };
    }
  }

  return { valid: true, reason: 'ok' };
}
