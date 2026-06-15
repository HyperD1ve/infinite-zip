/**
 * @typedef {import('../../../../src/types/index.js').Puzzle} Puzzle
 * @typedef {import('../../../../src/solver/solve.js').SolveResult} SolveResult
 */

import { wallKey } from '../../../../src/game/board.js';
import { GENERATOR_PARAMETER_COLUMNS, generatorParameterRow } from '../../../../src/generator/parameters.js';

export const CSV_COLUMNS = [
  'id',
  ...GENERATOR_PARAMETER_COLUMNS,
  'rows',
  'cols',
  'clues',
  'walls',
  'corner_clue_count',
  'edge_clue_count',
  'center_clue_count',
  'clue_spacing_entropy',
  'turn_count',
  'path_self_proximity',
  'mean_path_self_proximity',
  'wall_density',
  'clue_heatmap_entropy',
  'reflection_symmetry',
  'rotational_symmetry',
  'overall_symmetry',
  'solver_nodes_visited',
  'solver_backtracks',
  'average_branching_factor',
  'solution_count',
  'player_solve_rate',
  'player_avg_time',
  'player_hint_rate',
  'player_like_score',
];

/**
 * @param {Puzzle} puzzle
 * @param {SolveResult} solveResult
 * @param {{ id?: string }} options
 */
export function extractPuzzleStatistics(puzzle, solveResult, options = {}) {
  const clueLocations = countClueLocations(puzzle);
  const spacingEntropy = clueSpacingEntropy(puzzle);
  const selfProximity = pathSelfProximity(puzzle);
  const symmetry = symmetryFeatures(puzzle);
  const averageBranchingFactor = solveResult.stats.branchingEvents === 0
    ? 0
    : solveResult.stats.branchChoices / solveResult.stats.branchingEvents;
  const generatorParameters = puzzle.generatorParameters
    ? generatorParameterRow(puzzle.generatorParameters)
    : Object.fromEntries(GENERATOR_PARAMETER_COLUMNS.map((column) => [column, '']));

  return {
    id: options.id ?? puzzle.seed ?? '',
    ...generatorParameters,
    rows: puzzle.rows,
    cols: puzzle.cols,
    clues: puzzle.clues.length,
    walls: puzzle.walls.length,
    corner_clue_count: clueLocations.corner,
    edge_clue_count: clueLocations.edge,
    center_clue_count: clueLocations.center,
    clue_spacing_entropy: spacingEntropy,
    turn_count: countTurns(puzzle.solution ?? []),
    path_self_proximity: selfProximity.min,
    mean_path_self_proximity: selfProximity.mean,
    wall_density: wallDensity(puzzle),
    clue_heatmap_entropy: clueHeatmapEntropy(puzzle),
    reflection_symmetry: symmetry.reflection,
    rotational_symmetry: symmetry.rotational,
    overall_symmetry: symmetry.overall,
    solver_nodes_visited: solveResult.stats.nodesVisited,
    solver_backtracks: solveResult.stats.backtracks,
    average_branching_factor: averageBranchingFactor,
    solution_count: solveResult.solutionCount,
    player_solve_rate: '',
    player_avg_time: '',
    player_hint_rate: '',
    player_like_score: '',
  };
}

/**
 * @param {Puzzle} puzzle
 */
function countClueLocations(puzzle) {
  let corner = 0;
  let edge = 0;
  let center = 0;
  const lastRow = puzzle.rows - 1;
  const lastCol = puzzle.cols - 1;

  for (const clue of puzzle.clues) {
    const isCorner = (clue.row === 0 || clue.row === lastRow) && (clue.col === 0 || clue.col === lastCol);
    const isEdge = clue.row === 0 || clue.row === lastRow || clue.col === 0 || clue.col === lastCol;

    if (isCorner) {
      corner += 1;
    } else if (isEdge) {
      edge += 1;
    } else {
      center += 1;
    }
  }

  return { corner, edge, center };
}

/**
 * @param {Puzzle} puzzle
 */
function clueSpacingEntropy(puzzle) {
  if (!puzzle.solution || puzzle.clues.length < 2) {
    return 0;
  }

  const pathIndex = new Map(puzzle.solution.map((cell, index) => [`${cell.row},${cell.col}`, index]));
  const clueIndices = puzzle.clues
    .map((clue) => pathIndex.get(`${clue.row},${clue.col}`))
    .filter((index) => index !== undefined)
    .sort((a, b) => a - b);

  const gaps = [];
  for (let index = 1; index < clueIndices.length; index += 1) {
    gaps.push(clueIndices[index] - clueIndices[index - 1]);
  }

  return entropy(gaps);
}

/**
 * @param {import('../../../../src/types/index.js').SolutionPath} solution
 */
function countTurns(solution) {
  let turns = 0;

  for (let index = 2; index < solution.length; index += 1) {
    const a = solution[index - 2];
    const b = solution[index - 1];
    const c = solution[index];
    const first = { row: b.row - a.row, col: b.col - a.col };
    const second = { row: c.row - b.row, col: c.col - b.col };

    if (first.row !== second.row || first.col !== second.col) {
      turns += 1;
    }
  }

  return turns;
}

/**
 * @param {Puzzle} puzzle
 */
function pathSelfProximity(puzzle) {
  const path = puzzle.solution ?? [];
  let min = Infinity;
  let sum = 0;
  let count = 0;

  for (let first = 0; first < path.length; first += 1) {
    for (let second = first + 2; second < path.length; second += 1) {
      const distance = manhattan(path[first], path[second]);
      min = Math.min(min, distance);
      sum += distance;
      count += 1;
    }
  }

  return {
    min: Number.isFinite(min) ? min : 0,
    mean: count === 0 ? 0 : sum / count,
  };
}

/**
 * @param {Puzzle} puzzle
 */
function wallDensity(puzzle) {
  const possibleWalls = puzzle.rows * (puzzle.cols - 1) + puzzle.cols * (puzzle.rows - 1);
  return possibleWalls === 0 ? 0 : puzzle.walls.length / possibleWalls;
}

/**
 * @param {Puzzle} puzzle
 */
function clueHeatmapEntropy(puzzle) {
  const quadrants = [0, 0, 0, 0];

  for (const clue of puzzle.clues) {
    const vertical = clue.row < puzzle.rows / 2 ? 0 : 2;
    const horizontal = clue.col < puzzle.cols / 2 ? 0 : 1;
    quadrants[vertical + horizontal] += 1;
  }

  return entropy(quadrants);
}

/**
 * @param {Puzzle} puzzle
 */
function symmetryFeatures(puzzle) {
  const tokens = puzzleTokens(puzzle);
  const reflected = transformTokens(puzzle, reflectCell);
  const rotated = transformTokens(puzzle, rotateCell);
  const reflection = overlapRatio(tokens, reflected);
  const rotational = overlapRatio(tokens, rotated);

  return {
    reflection,
    rotational,
    overall: (reflection + rotational) / 2,
  };
}

/**
 * @param {Puzzle} puzzle
 */
function puzzleTokens(puzzle) {
  const tokens = new Set();

  for (const clue of puzzle.clues) {
    tokens.add(`clue:${clue.row},${clue.col}`);
  }

  for (const wall of puzzle.walls) {
    tokens.add(`wall:${wallKey(wall.a, wall.b)}`);
  }

  return tokens;
}

/**
 * @param {Puzzle} puzzle
 * @param {(puzzle: Puzzle, cell: import('../../../../src/types/index.js').Cell) => import('../../../../src/types/index.js').Cell} transform
 */
function transformTokens(puzzle, transform) {
  const tokens = new Set();

  for (const clue of puzzle.clues) {
    const transformed = transform(puzzle, clue);
    tokens.add(`clue:${transformed.row},${transformed.col}`);
  }

  for (const wall of puzzle.walls) {
    const a = transform(puzzle, wall.a);
    const b = transform(puzzle, wall.b);
    tokens.add(`wall:${wallKey(a, b)}`);
  }

  return tokens;
}

/**
 * @param {Puzzle} puzzle
 * @param {import('../../../../src/types/index.js').Cell} cell
 */
function reflectCell(puzzle, cell) {
  return { row: cell.row, col: puzzle.cols - 1 - cell.col };
}

/**
 * @param {Puzzle} puzzle
 * @param {import('../../../../src/types/index.js').Cell} cell
 */
function rotateCell(puzzle, cell) {
  return { row: puzzle.rows - 1 - cell.row, col: puzzle.cols - 1 - cell.col };
}

/**
 * @param {Set<string>} original
 * @param {Set<string>} transformed
 */
function overlapRatio(original, transformed) {
  if (original.size === 0) {
    return 1;
  }

  let matches = 0;
  for (const token of original) {
    if (transformed.has(token)) {
      matches += 1;
    }
  }

  return matches / original.size;
}

/**
 * @param {number[]} values
 */
function entropy(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return 0;
  }

  let score = 0;
  for (const value of values) {
    if (value <= 0) {
      continue;
    }
    const probability = value / total;
    score -= probability * Math.log2(probability);
  }

  return score;
}

/**
 * @param {import('../../../../src/types/index.js').Cell} a
 * @param {import('../../../../src/types/index.js').Cell} b
 */
function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}
