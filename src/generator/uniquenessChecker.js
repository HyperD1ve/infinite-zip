import { countSolutions } from '../solver/solve.js';

/**
 * @param {import('../types/index.js').Puzzle} puzzle
 */
export function checkUniqueness(puzzle) {
  const result = countSolutions(
    {
      rows: puzzle.rows,
      cols: puzzle.cols,
      clues: puzzle.clues,
      walls: puzzle.walls ?? [],
    },
    { maxSolutions: 2, maxNodes: 300000 },
  );

  return {
    unique: result.solutionCount === 1 && !result.limitHit,
    solutionCount: result.solutionCount,
    limitHit: result.limitHit,
    stats: result.stats,
  };
}
