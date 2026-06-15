/**
 * @import { Cell, SolutionPath } from '../types/index.js'
 */
import { allCells, assertBoardSize, cellKey, neighbors, validateSolutionPath } from '../game/board.js';
import { createRng, shuffled } from './random.js';

/**
 * @param {number} rows
 * @param {number} cols
 * @param {string} seed
 * @returns {SolutionPath}
 */
export function generateSolution(rows, cols, seed) {
  assertBoardSize(rows, cols);

  const rng = createRng(`solution:${rows}x${cols}:${seed}`);
  const starts = shuffled(allCells(rows, cols), rng);

  for (const start of starts) {
    const path = searchHamiltonianPath(rows, cols, start, rng);
    if (path) {
      const validation = validateSolutionPath(rows, cols, path);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }
      return path;
    }
  }

  return generateSerpentineFallback(rows, cols, seed);
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} start
 * @param {() => number} rng
 * @returns {SolutionPath | null}
 */
function searchHamiltonianPath(rows, cols, start, rng) {
  /** @type {SolutionPath} */
  const path = [start];
  const visited = new Set([cellKey(start)]);
  const total = rows * cols;
  const deadline = performanceNow() + 80;

  /**
   * @param {Cell} current
   * @returns {boolean}
   */
  function visit(current) {
    if (path.length === total) {
      return true;
    }

    if (performanceNow() > deadline) {
      return false;
    }

    const candidates = orderedMoves(rows, cols, current, visited, rng);
    for (const candidate of candidates) {
      const key = cellKey(candidate);
      visited.add(key);
      path.push(candidate);

      if (remainingCellsAreConnected(rows, cols, visited) && visit(candidate)) {
        return true;
      }

      path.pop();
      visited.delete(key);
    }

    return false;
  }

  return visit(start) ? [...path] : null;
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} current
 * @param {Set<string>} visited
 * @param {() => number} rng
 */
function orderedMoves(rows, cols, current, visited, rng) {
  return shuffled(
    neighbors(rows, cols, current).filter((candidate) => !visited.has(cellKey(candidate))),
    rng,
  ).sort((a, b) => onwardDegree(rows, cols, a, visited) - onwardDegree(rows, cols, b, visited));
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} cell
 * @param {Set<string>} visited
 */
function onwardDegree(rows, cols, cell, visited) {
  return neighbors(rows, cols, cell).filter((candidate) => !visited.has(cellKey(candidate))).length;
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Set<string>} visited
 */
function remainingCellsAreConnected(rows, cols, visited) {
  let start = null;
  let remainingCount = 0;

  for (const cell of allCells(rows, cols)) {
    if (!visited.has(cellKey(cell))) {
      start ??= cell;
      remainingCount += 1;
    }
  }

  if (!start) {
    return true;
  }

  const reached = new Set([cellKey(start)]);
  const queue = [start];
  while (queue.length > 0) {
    const cell = queue.shift();
    for (const next of neighbors(rows, cols, cell)) {
      const key = cellKey(next);
      if (!visited.has(key) && !reached.has(key)) {
        reached.add(key);
        queue.push(next);
      }
    }
  }

  return reached.size === remainingCount;
}

/**
 * The randomized search is fast for normal app sizes, but a deterministic fallback
 * keeps puzzle generation total instead of probabilistic.
 *
 * @param {number} rows
 * @param {number} cols
 * @param {string} seed
 */
function generateSerpentineFallback(rows, cols, seed) {
  const flipRows = seed.charCodeAt(0) % 2 === 0;
  const flipCols = seed.charCodeAt(seed.length - 1) % 2 === 0;
  /** @type {SolutionPath} */
  const path = [];

  for (let rawRow = 0; rawRow < rows; rawRow += 1) {
    const row = flipRows ? rows - 1 - rawRow : rawRow;
    const leftToRight = rawRow % 2 === 0;
    for (let rawCol = 0; rawCol < cols; rawCol += 1) {
      const serpentineCol = leftToRight ? rawCol : cols - 1 - rawCol;
      const col = flipCols ? cols - 1 - serpentineCol : serpentineCol;
      path.push({ row, col });
    }
  }

  return path;
}

function performanceNow() {
  if (typeof performance !== 'undefined') {
    return performance.now();
  }
  return Date.now();
}
