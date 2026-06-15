/**
 * @import { Puzzle } from '../types/index.js'
 */
import { cellKey, normalizeWalls, validateSolutionPath } from './board.js';
import { normalizeClues } from '../solver/constraints.js';

/**
 * @param {Puzzle} puzzle
 */
export function validatePuzzle(puzzle) {
  normalizeClues(puzzle.rows, puzzle.cols, puzzle.clues);
  const walls = normalizeWalls(puzzle.rows, puzzle.cols, puzzle.walls ?? []);

  if (puzzle.solution) {
    const validation = validateSolutionPath(puzzle.rows, puzzle.cols, puzzle.solution, walls);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const clueCells = new Map(puzzle.clues.map((clue) => [cellKey(clue), clue.number]));
    const solutionClueNumbers = puzzle.solution
      .map((cell) => clueCells.get(cellKey(cell)))
      .filter((number) => number !== undefined);

    for (let index = 0; index < solutionClueNumbers.length; index += 1) {
      if (solutionClueNumbers[index] !== index + 1) {
        throw new Error('Solution does not pass through clues in order.');
      }
    }
  }

  return true;
}

/**
 * @param {Puzzle} puzzle
 */
export function publicPuzzle(puzzle) {
  return {
    rows: puzzle.rows,
    cols: puzzle.cols,
    clues: puzzle.clues.map((clue) => ({ ...clue })),
    walls: (puzzle.walls ?? []).map((wall) => ({ a: { ...wall.a }, b: { ...wall.b } })),
    seed: puzzle.seed,
    difficulty: puzzle.difficulty,
  };
}
