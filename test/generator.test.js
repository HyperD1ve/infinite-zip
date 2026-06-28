import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateSolutionPath } from '../src/game/board.js';
import { publicPuzzle, validatePuzzle } from '../src/game/puzzle.js';
import { buildCluesFromPath } from '../src/generator/generateClues.js';
import {
  GENERATOR_PARAMETER_RANGES,
  crossoverGeneratorParameters,
  mutateGeneratorParameters,
  normalizeGeneratorParameters,
} from '../src/generator/parameters.js';
import { generatePuzzle } from '../src/generator/puzzle.js';
import { generateSolution } from '../src/generator/generateSolution.js';
import { countSolutions } from '../src/solver/solve.js';
import { arrowDestination, isArrowKey } from '../src/ui/input.js';

test('solution generation visits every cell exactly once', () => {
  const solution = generateSolution(5, 5, 'PATH-TEST');
  assert.equal(solution.length, 25);
  assert.deepEqual(validateSolutionPath(5, 5, solution), { valid: true, reason: 'ok' });
});

test('fully clued puzzle has exactly one clue-only solution', () => {
  const solution = generateSolution(4, 4, 'FULL-CLUE');
  const clues = buildCluesFromPath(solution, solution.map((_, index) => index));
  const result = countSolutions({ rows: 4, cols: 4, clues, walls: [], solution: [...solution].reverse() }, { maxSolutions: 2 });

  assert.equal(result.limitHit, false);
  assert.equal(result.solutionCount, 1);
});

test('walls block otherwise valid paths in the solver', () => {
  const solution = generateSolution(4, 4, 'WALL-BLOCK');
  const clues = buildCluesFromPath(solution, solution.map((_, index) => index));
  const walls = [{ a: solution[0], b: solution[1] }];
  const result = countSolutions({ rows: 4, cols: 4, clues, walls }, { maxSolutions: 2 });

  assert.equal(validateSolutionPath(4, 4, solution, walls).valid, false);
  assert.equal(result.limitHit, false);
  assert.equal(result.solutionCount, 0);
});

test('generated puzzle is valid and uniquely solvable from clues', () => {
  const puzzle = generatePuzzle({ rows: 5, cols: 5, seed: 'UNIQUE-1', target: 'medium' });
  const result = countSolutions(
    { rows: puzzle.rows, cols: puzzle.cols, clues: puzzle.clues, walls: puzzle.walls },
    { maxSolutions: 2 },
  );

  assert.equal(validatePuzzle(puzzle), true);
  assert.equal(validateSolutionPath(puzzle.rows, puzzle.cols, puzzle.solution, puzzle.walls).valid, true);
  assert.equal(result.limitHit, false);
  assert.equal(result.solutionCount, 1);
});

test('solver logs proficiency metrics with branch choices', () => {
  const puzzle = generatePuzzle({ rows: 4, cols: 4, seed: 'SOLVER-STATS', target: 'medium' });
  const result = countSolutions(
    { rows: puzzle.rows, cols: puzzle.cols, clues: puzzle.clues, walls: puzzle.walls },
    { maxSolutions: 2 },
  );

  assert.equal(Number.isInteger(result.stats.nodesVisited), true);
  assert.equal(Number.isInteger(result.stats.backtracks), true);
  assert.equal(Number.isInteger(result.stats.branchingEvents), true);
  assert.equal(Number.isInteger(result.stats.branchChoices), true);
  assert.equal('nodes' in result.stats, false);
  assert.equal('branchPoints' in result.stats, false);
  assert.ok(result.stats.nodesVisited > 0);
  assert.ok(result.stats.branchChoices >= result.stats.branchingEvents);
});

test('generated puzzles retain tunable generator parameters', () => {
  const parameters = normalizeGeneratorParameters('medium', {
    clueDensity: 0.5,
    wallDensity: 0,
    turnBias: 0.78,
    clueSpacingBias: 0.65,
  });
  const puzzle = generatePuzzle({ rows: 4, cols: 4, seed: 'PARAMS-1', parameters });

  assert.deepEqual(puzzle.generatorParameters, parameters);
  assert.equal(puzzle.walls.length, 0);
  assert.ok(puzzle.clues.length >= Math.ceil(16 * parameters.clueDensity));
});

test('generator parameter mutation remains deterministic and bounded', () => {
  const base = normalizeGeneratorParameters('hard', {
    clueDensity: 0.99,
    wallDensity: -1,
  });
  const first = mutateGeneratorParameters(base, 'MUTATE-1', {
    mutationRate: 1,
    mutationStrength: 1,
  });
  const second = mutateGeneratorParameters(base, 'MUTATE-1', {
    mutationRate: 1,
    mutationStrength: 1,
  });

  assert.deepEqual(first, second);
  for (const [key, value] of Object.entries(first)) {
    const [min, max] = GENERATOR_PARAMETER_RANGES[key];
    assert.ok(value >= min, `${key} should be >= ${min}`);
    assert.ok(value <= max, `${key} should be <= ${max}`);
  }
});

test('generator parameter crossover chooses bounded parent values', () => {
  const parentA = normalizeGeneratorParameters('easy');
  const parentB = normalizeGeneratorParameters('hard');
  const child = crossoverGeneratorParameters(parentA, parentB, 'CROSSOVER-1');

  for (const [key, value] of Object.entries(child)) {
    assert.ok(value === parentA[key] || value === parentB[key], `${key} should come from one parent`);
  }
});

test('public puzzle omits the solution path', () => {
  const puzzle = generatePuzzle({ rows: 4, cols: 4, seed: 'PUBLIC-1', target: 'easy' });
  const publicData = publicPuzzle(puzzle);

  assert.equal('solution' in publicData, false);
  assert.equal(publicData.clues.length, puzzle.clues.length);
  assert.equal(publicData.walls.length, puzzle.walls.length);
});

test('arrow input maps to bounded neighboring cells', () => {
  assert.equal(isArrowKey('ArrowLeft'), true);
  assert.equal(isArrowKey('Enter'), false);
  assert.deepEqual(arrowDestination(5, 5, { row: 2, col: 2 }, 'ArrowUp'), { row: 1, col: 2 });
  assert.deepEqual(arrowDestination(5, 5, { row: 2, col: 2 }, 'ArrowRight'), { row: 2, col: 3 });
  assert.equal(arrowDestination(5, 5, { row: 0, col: 0 }, 'ArrowLeft'), null);
});
