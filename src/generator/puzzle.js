/**
 * @import { Puzzle } from '../types/index.js'
 */
import { validatePuzzle } from '../game/puzzle.js';
import { generateSolution } from './generateSolution.js';
import { generateWalls } from './generateWalls.js';
import { createRng, defaultSeed } from './random.js';
import { addClueInLargestGap, buildCluesFromPath, selectParameterizedClueIndices } from './generateClues.js';
import { rateDifficulty } from './difficulty.js';
import { checkUniqueness } from './uniquenessChecker.js';
import { normalizeGeneratorParameters, parameterSignature } from './parameters.js';

/**
 * @param {{ rows?: number, cols?: number, seed?: string, target?: 'easy' | 'medium' | 'hard', parameters?: Partial<import('./parameters.js').GeneratorParameters> }} options
 * @returns {Puzzle & { solverStats: ReturnType<typeof checkUniqueness>['stats'] }}
 */
export function generatePuzzle(options = {}) {
  const rows = options.rows ?? 6;
  const cols = options.cols ?? 6;
  const seed = options.seed?.trim() || defaultSeed();
  const target = options.target ?? 'medium';
  const generatorParameters = normalizeGeneratorParameters(target, options.parameters);
  const solution = generateSolution(rows, cols, seed);
  const walls = generateWalls(rows, cols, solution, seed, generatorParameters.wallDensity);
  const total = rows * cols;
  const startingClues = Math.ceil(total * generatorParameters.clueDensity);
  const clueRng = createRng(`clues:${rows}x${cols}:${seed}:${parameterSignature(generatorParameters)}`);
  let indices = selectParameterizedClueIndices(
    solution,
    startingClues,
    generatorParameters.clueSpacingBias,
    clueRng,
  );
  let lastCheck = null;

  while (indices.length <= total) {
    const clues = buildCluesFromPath(solution, indices);
    const puzzle = { rows, cols, clues, walls, solution, seed, generatorParameters };
    lastCheck = checkUniqueness(puzzle);

    if (lastCheck.unique) {
      const difficulty = rateDifficulty({
        rows,
        cols,
        clueCount: clues.length,
        stats: lastCheck.stats,
      });
      const completed = { ...puzzle, difficulty, solverStats: lastCheck.stats };
      validatePuzzle(completed);
      return completed;
    }

    if (indices.length === total) {
      break;
    }
    indices = addClueInLargestGap(indices, total);
  }

  throw new Error(
    lastCheck?.limitHit
      ? 'Solver limit reached before uniqueness could be proven.'
      : 'Could not generate a unique puzzle.',
  );
}
