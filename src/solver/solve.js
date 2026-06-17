/**
 * @import { Cell, Clue, Puzzle, SolutionPath } from '../types/index.js'
 */
import { buildWallSet, cellKey, manhattan, normalizeWalls, passableNeighbors, sameCell } from '../game/board.js';
import { buildClueMap, normalizeClues } from './constraints.js';

/**
 * @typedef {{
 *   maxSolutions?: number,
 *   maxNodes?: number,
 *   collectSolutions?: boolean
 * }} SolveOptions
 *
 * @typedef {{
 *   solutionCount: number,
 *   solutions: SolutionPath[],
 *   limitHit: boolean,
 *   stats: {
 *     nodesVisited: number,
 *     backtracks: number,
 *     branchingEvents: number,
 *     branchChoices: number
 *   }
 * }} SolveResult
 */

/**
 * Count paths using clue information only. The optional `solution` field is
 * intentionally ignored so generation can use this as a uniqueness proof.
 *
 * @param {Puzzle} puzzle
 * @param {SolveOptions} options
 * @returns {SolveResult}
 */
export function countSolutions(puzzle, options = {}) {
  const { rows, cols } = puzzle;
  const clues = normalizeClues(rows, cols, puzzle.clues);
  const walls = normalizeWalls(rows, cols, puzzle.walls ?? []);
  const wallSet = buildWallSet(walls);
  const clueByCell = buildClueMap(clues);
  const maxSolutions = options.maxSolutions ?? 2;
  const maxNodes = options.maxNodes ?? 250000;
  const totalCells = rows * cols;
  const start = clueAsCell(clues[0]);
  const finalClue = clues[clues.length - 1];

  /** @type {SolutionPath} */
  const path = [start];
  const visited = new Set([cellKey(start)]);
  /** @type {SolutionPath[]} */
  const solutions = [];
  const stats = { nodesVisited: 0, backtracks: 0, branchingEvents: 0, branchChoices: 0 };
  let solutionCount = 0;
  let limitHit = false;

  /**
   * @param {Cell} current
   * @param {number} nextClueIndex
   */
  function dfs(current, nextClueIndex) {
    if (solutionCount >= maxSolutions || limitHit) {
      return;
    }

    stats.nodesVisited += 1;
    if (stats.nodesVisited > maxNodes) {
      limitHit = true;
      return;
    }

    if (path.length === totalCells) {
      if (nextClueIndex === clues.length && sameCell(current, finalClue)) {
        solutionCount += 1;
        if (options.collectSolutions) {
          solutions.push(path.map((cell) => ({ ...cell })));
        }
      }
      return;
    }

    if (nextClueIndex >= clues.length) {
      return;
    }

    if (nextClueIndex < clues.length && !canStillReachNextClue(rows, cols, current, visited, clues, clueByCell, wallSet, nextClueIndex)) {
      return;
    }

    if (hasIsolatedUnvisitedCell(rows, cols, current, visited, wallSet)) {
      return;
    }

    const candidates = legalMoves(rows, cols, current, visited, clues, clueByCell, wallSet, nextClueIndex, totalCells, path.length)
      .sort((a, b) => onwardDegree(rows, cols, a, visited, wallSet) - onwardDegree(rows, cols, b, visited, wallSet));

    if (candidates.length > 1) {
      stats.branchingEvents += 1;
      stats.branchChoices += candidates.length;
    }

    for (const candidate of candidates) {
      const key = cellKey(candidate);
      const clue = clueByCell.get(key);
      const nextIndex = clue ? nextClueIndex + 1 : nextClueIndex;

      visited.add(key);
      path.push(candidate);
      dfs(candidate, nextIndex);
      path.pop();
      visited.delete(key);

      if (solutionCount >= maxSolutions || limitHit) {
        return;
      }
    }

    stats.backtracks += 1;
  }

  dfs(start, 1);

  return {
    solutionCount,
    solutions,
    limitHit,
    stats,
  };
}

/**
 * @param {Clue} clue
 * @returns {Cell}
 */
function clueAsCell(clue) {
  return { row: clue.row, col: clue.col };
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} current
 * @param {Set<string>} visited
 * @param {Clue[]} clues
 * @param {Map<string, Clue>} clueByCell
 * @param {Set<string>} wallSet
 * @param {number} nextClueIndex
 * @param {number} totalCells
 * @param {number} pathLength
 */
function legalMoves(rows, cols, current, visited, clues, clueByCell, wallSet, nextClueIndex, totalCells, pathLength) {
  return passableNeighbors(rows, cols, current, wallSet).filter((candidate) => {
    const key = cellKey(candidate);
    if (visited.has(key)) {
      return false;
    }

    const clue = clueByCell.get(key);
    if (!clue) {
      return true;
    }

    const nextClue = clues[nextClueIndex];
    if (!nextClue || clue.number !== nextClue.number) {
      return false;
    }

    if (clue.number === clues.length) {
      return pathLength === totalCells - 1;
    }

    return true;
  });
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} candidate
 * @param {Set<string>} visited
 * @param {Set<string>} wallSet
 */
function onwardDegree(rows, cols, candidate, visited, wallSet) {
  return passableNeighbors(rows, cols, candidate, wallSet).filter((next) => !visited.has(cellKey(next))).length;
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} current
 * @param {Set<string>} visited
 * @param {Clue[]} clues
 * @param {Map<string, Clue>} clueByCell
 * @param {Set<string>} wallSet
 * @param {number} nextClueIndex
 */
function canStillReachNextClue(rows, cols, current, visited, clues, clueByCell, wallSet, nextClueIndex) {
  const target = clues[nextClueIndex];
  if (!target) {
    return false;
  }

  const remainingSteps = rows * cols - visited.size;
  if (manhattan(current, target) > remainingSteps) {
    return false;
  }

  const targetKey = cellKey(target);
  const reached = new Set([cellKey(current)]);
  const queue = [current];

  while (queue.length > 0) {
    const cell = queue.shift();
    if (cell && sameCell(cell, target)) {
      return true;
    }

    for (const next of passableNeighbors(rows, cols, cell, wallSet)) {
      const key = cellKey(next);
      if (visited.has(key) || reached.has(key)) {
        continue;
      }

      const clue = clueByCell.get(key);
      if (clue && key !== targetKey) {
        continue;
      }

      reached.add(key);
      queue.push(next);
    }
  }

  return false;
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} current
 * @param {Set<string>} visited
 * @param {Set<string>} wallSet
 */
function hasIsolatedUnvisitedCell(rows, cols, current, visited, wallSet) {
  const currentKey = cellKey(current);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = { row, col };
      const key = cellKey(cell);
      if (visited.has(key)) {
        continue;
      }

      const openNeighborCount = passableNeighbors(rows, cols, cell, wallSet).filter((next) => {
        const nextKey = cellKey(next);
        return nextKey === currentKey || !visited.has(nextKey);
      }).length;

      if (openNeighborCount === 0) {
        return true;
      }
    }
  }

  return false;
}
