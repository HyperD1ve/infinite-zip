#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generatePuzzle } from '../../../../src/generator/puzzle.js';
import { validatePuzzle } from '../../../../src/game/puzzle.js';
import { countSolutions } from '../../../../src/solver/solve.js';
import { CSV_COLUMNS, extractPuzzleStatistics } from './features.js';
import { writeCsv } from './csv.js';

const repoRoot = path.join(fileURLToPath(new URL('../../../..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'assets', 'data');

const options = parseArgs(process.argv.slice(2));
const puzzles = options.input
  ? loadInputPuzzles(options.input)
  : generatePuzzles(options);
const rows = puzzles.map((puzzle) => {
  validatePuzzle(puzzle);
  const solveResult = countSolutions(
    { rows: puzzle.rows, cols: puzzle.cols, clues: puzzle.clues, walls: puzzle.walls },
    { maxSolutions: options.maxSolutions, maxNodes: options.maxNodes },
  );
  return extractPuzzleStatistics(puzzle, solveResult, { id: puzzle.seed });
});

writeCsv(options.output, rows, CSV_COLUMNS);
console.log(`Wrote ${rows.length} rows to ${options.output}`);

/**
 * @param {{ count: number, rows: number, cols: number, target: 'easy' | 'medium' | 'hard', seedPrefix: string }} options
 */
function generatePuzzles(options) {
  const puzzles = [];

  for (let index = 0; index < options.count; index += 1) {
    const seed = `${options.seedPrefix}-${String(index + 1).padStart(4, '0')}`;
    puzzles.push(generatePuzzle({
      rows: options.rows,
      cols: options.cols,
      target: options.target,
      seed,
    }));
  }

  return puzzles;
}

/**
 * @param {string} inputPath
 */
function loadInputPuzzles(inputPath) {
  const stats = fs.statSync(inputPath);
  if (stats.isDirectory()) {
    return fs.readdirSync(inputPath)
      .filter((file) => file.endsWith('.json') && file !== 'puzzles.json')
      .sort()
      .flatMap((file) => loadInputPuzzles(path.join(inputPath, file)));
  }

  const parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const puzzles = Array.isArray(parsed) ? parsed : [parsed];
  return puzzles.map((puzzle, index) => ({
    ...puzzle,
    seed: puzzle.seed ?? `${path.basename(inputPath, '.json')}-${index + 1}`,
  }));
}

/**
 * @param {string[]} args
 */
function parseArgs(args) {
  const parsed = {
    count: 25,
    rows: 5,
    cols: 5,
    target: 'medium',
    seedPrefix: 'ZIP-STATS',
    maxSolutions: 2,
    maxNodes: 300000,
    input: null,
    output: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--input') {
      parsed.input = path.resolve(next);
      index += 1;
    } else if (arg === '--count') {
      parsed.count = parsePositiveInt(next, '--count');
      index += 1;
    } else if (arg === '--rows') {
      parsed.rows = parsePositiveInt(next, '--rows');
      index += 1;
    } else if (arg === '--cols') {
      parsed.cols = parsePositiveInt(next, '--cols');
      index += 1;
    } else if (arg === '--target') {
      parsed.target = parseTarget(next);
      index += 1;
    } else if (arg === '--seed-prefix') {
      parsed.seedPrefix = next || parsed.seedPrefix;
      index += 1;
    } else if (arg === '--max-solutions') {
      parsed.maxSolutions = parsePositiveInt(next, '--max-solutions');
      index += 1;
    } else if (arg === '--max-nodes') {
      parsed.maxNodes = parsePositiveInt(next, '--max-nodes');
      index += 1;
    } else if (arg === '--output') {
      parsed.output = path.resolve(next || parsed.output);
      index += 1;
    } else if (arg === '--help') {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  parsed.output ??= defaultOutputFor(parsed);
  return parsed;
}

/**
 * @param {{ input: string | null, seedPrefix: string }} options
 */
function defaultOutputFor(options) {
  if (!options.input) {
    return path.join(defaultOutputDir, 'zip-statistics.csv');
  }

  const inputStats = fs.statSync(options.input);
  const baseName = inputStats.isDirectory()
    ? path.basename(options.input)
    : path.basename(options.input, path.extname(options.input));
  return path.join(defaultOutputDir, `${baseName}-statistics.csv`);
}

/**
 * @param {string | undefined} value
 * @param {string} name
 */
function parsePositiveInt(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

/**
 * @param {string | undefined} value
 */
function parseTarget(value) {
  if (value === 'easy' || value === 'medium' || value === 'hard') {
    return value;
  }
  throw new Error('--target must be easy, medium, or hard.');
}

function printHelpAndExit() {
  console.log(`Usage: node .agents/skills/collect-statistics/scripts/collect.js [options]

Options:
  --input <path>       Puzzle JSON file or directory. Default: generate puzzles
  --count <n>          Number of generated puzzles. Default: 25
  --rows <n>           Board rows. Default: 5
  --cols <n>           Board columns. Default: 5
  --target <level>     easy, medium, or hard. Default: medium
  --seed-prefix <text> Seed prefix. Default: ZIP-STATS
  --max-solutions <n>  Solver solution cap. Default: 2
  --max-nodes <n>      Solver node cap. Default: 300000
  --output <path>      CSV output path. Default uses the input basename.
`);
  process.exit(0);
}
