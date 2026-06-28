#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CSV_COLUMNS, extractPuzzleStatistics } from '../../.agents/skills/collect-statistics/scripts/features.js';
import { writeCsv } from '../../.agents/skills/collect-statistics/scripts/csv.js';
import { generatePuzzle } from '../../src/generator/puzzle.js';
import {
  crossoverGeneratorParameters,
  generatorParameterRow,
  mutateGeneratorParameters,
  sampleGeneratorParameters,
} from '../../src/generator/parameters.js';
import { createRng, randomInt } from '../../src/generator/random.js';
import { countSolutions } from '../../src/solver/solve.js';
import { SCORE_COLUMNS, scoreCandidates } from '../../src/optimization/scoring.js';

const repoRoot = path.join(fileURLToPath(new URL('../..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'assets', 'data', 'experiments');
const SEARCH_COLUMNS = [
  'search_algorithm',
  'search_generation',
  'parent_a_id',
  'parent_b_id',
];
const options = parseArgs(process.argv.slice(2));
const experimentId = options.experimentId ?? `${options.seedPrefix}-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`;

const historyRows = [];
const candidateRecords = [];

if (options.algorithm === 'random') {
  runRandomSearch();
} else {
  runEvolutionarySearch();
}

const ranked = candidateRecords
  .filter((record) => record.row.generation_status === 'valid_unique')
  .sort((a, b) => Number(b.row.ranking_score) - Number(a.row.ranking_score))
  .slice(0, options.top);

ranked.forEach((record, index) => {
  record.row.candidate_rank = index + 1;
});

fs.mkdirSync(options.outputDir, { recursive: true });
const historyPath = path.join(options.outputDir, `${experimentId}-history.csv`);
const candidatesPath = path.join(options.outputDir, `${experimentId}-top-candidates.json`);
const columns = [
  'experiment_id',
  ...SEARCH_COLUMNS,
  'generation_status',
  'candidate_rank',
  ...CSV_COLUMNS,
  ...SCORE_COLUMNS,
  'error',
];

writeCsv(historyPath, historyRows, columns);
fs.writeFileSync(
  candidatesPath,
  `${JSON.stringify(ranked.map((record) => ({
    rank: record.row.candidate_rank,
    rankingScore: record.row.ranking_score,
    scorerName: record.row.scorer_name,
    searchAlgorithm: record.row.search_algorithm,
    searchGeneration: record.row.search_generation,
    parentAId: record.row.parent_a_id,
    parentBId: record.row.parent_b_id,
    featureRow: record.row,
    puzzle: record.puzzle,
  })), null, 2)}\n`,
);

console.log(`Experiment ${experimentId}`);
console.log(`Algorithm: ${options.algorithm}`);
console.log(`Wrote history: ${historyPath}`);
console.log(`Wrote top ${ranked.length}: ${candidatesPath}`);

function runRandomSearch() {
  for (let index = 0; index < options.count; index += 1) {
    const seed = `${options.seedPrefix}-${String(index + 1).padStart(5, '0')}`;
    const parameters = sampleGeneratorParameters(seed);
    evaluateCandidate(seed, parameters, {
      generation: 0,
      parentAId: '',
      parentBId: '',
    });
  }

  scoreRecords(candidateRecords);
}

function runEvolutionarySearch() {
  let evaluations = 0;
  let generation = 0;
  let population = createRandomPopulation(Math.min(options.populationSize, options.count), 'initial');

  while (evaluations < options.count) {
    const generationRecords = [];
    const generationSize = Math.min(population.length, options.count - evaluations);

    for (let index = 0; index < generationSize; index += 1) {
      const individual = population[index];
      const seed = `${options.seedPrefix}-G${String(generation).padStart(3, '0')}-${String(evaluations + 1).padStart(5, '0')}`;
      const record = evaluateCandidate(seed, individual.parameters, {
        generation,
        parentAId: individual.parentAId,
        parentBId: individual.parentBId,
      });

      if (record) {
        generationRecords.push(record);
      }
      evaluations += 1;
    }

    scoreRecords(generationRecords);
    generation += 1;

    if (evaluations >= options.count) {
      break;
    }

    population = createNextEvolutionaryPopulation(
      Math.min(options.populationSize, options.count - evaluations),
      generation,
    );
  }
}

/**
 * @param {number} size
 * @param {string} label
 */
function createRandomPopulation(size, label) {
  return Array.from({ length: size }, (_, index) => ({
    parameters: sampleGeneratorParameters(`${options.seedPrefix}-${label}-${index + 1}`),
    parentAId: '',
    parentBId: '',
  }));
}

/**
 * @param {number} size
 * @param {number} generation
 */
function createNextEvolutionaryPopulation(size, generation) {
  const rng = createRng(`evolution:${experimentId}:${generation}`);
  const elites = selectElite();

  if (elites.length === 0) {
    return createRandomPopulation(size, `fallback-${generation}`);
  }

  return Array.from({ length: size }, (_, index) => {
    const seed = `${experimentId}:g${generation}:i${index + 1}`;
    if (rng() < options.explorationRate) {
      return {
        parameters: sampleGeneratorParameters(`${seed}:explore`),
        parentAId: '',
        parentBId: '',
      };
    }

    const parentA = elites[randomInt(rng, 0, elites.length)];
    const parentB = elites[randomInt(rng, 0, elites.length)];
    const crossed = crossoverGeneratorParameters(parentA.parameters, parentB.parameters, seed);
    return {
      parameters: mutateGeneratorParameters(crossed, seed, {
        mutationRate: options.mutationRate,
        mutationStrength: options.mutationStrength,
      }),
      parentAId: parentA.row.id,
      parentBId: parentB.row.id,
    };
  });
}

function selectElite() {
  return candidateRecords
    .filter((record) => record.row.generation_status === 'valid_unique')
    .filter((record) => Number.isFinite(Number(record.row.ranking_score)))
    .sort((a, b) => Number(b.row.ranking_score) - Number(a.row.ranking_score))
    .slice(0, options.eliteCount);
}

/**
 * @param {string} seed
 * @param {import('../../src/generator/parameters.js').GeneratorParameters} parameters
 * @param {{ generation: number, parentAId: string, parentBId: string }} search
 */
function evaluateCandidate(seed, parameters, search) {
  const searchRow = {
    search_algorithm: options.algorithm,
    search_generation: search.generation,
    parent_a_id: search.parentAId,
    parent_b_id: search.parentBId,
  };

  try {
    const puzzle = generatePuzzle({
      rows: options.rows,
      cols: options.cols,
      seed,
      target: options.target,
      parameters,
    });
    const solveResult = countSolutions(
      { rows: puzzle.rows, cols: puzzle.cols, clues: puzzle.clues, walls: puzzle.walls },
      { maxSolutions: 2, maxNodes: options.maxNodes },
    );
    const featureRow = extractPuzzleStatistics(puzzle, solveResult, { id: seed });
    const row = {
      experiment_id: experimentId,
      ...searchRow,
      generation_status: solveResult.solutionCount === 1 && !solveResult.limitHit ? 'valid_unique' : 'solver_rejected',
      ...featureRow,
      ...generatorParameterRow(parameters),
    };

    historyRows.push(row);
    const record = { row, puzzle, parameters: puzzle.generatorParameters ?? parameters };
    candidateRecords.push(record);
    return record;
  } catch (error) {
    historyRows.push({
      experiment_id: experimentId,
      ...searchRow,
      generation_status: 'generation_failed',
      id: seed,
      ...generatorParameterRow(parameters),
      scorer_name: 'none',
      predicted_quality_score: '',
      ranking_score: '',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * @param {{ row: Record<string, unknown> }[]} records
 */
function scoreRecords(records) {
  const scoreableRecords = records.filter((record) => record.row.generation_status !== 'generation_failed');
  if (scoreableRecords.length === 0) {
    return;
  }

  const scores = scoreCandidates(scoreableRecords.map((record) => record.row), {
    scorer: options.scorer,
    modelMetadataPath: options.modelMetadataPath,
    predictScriptPath: options.predictScriptPath,
  });

  for (let index = 0; index < scoreableRecords.length; index += 1) {
    Object.assign(scoreableRecords[index].row, scores[index]);
  }
}

/**
 * @param {string[]} args
 */
function parseArgs(args) {
  const parsed = {
    count: 100,
    top: 3,
    rows: 6,
    cols: 6,
    target: 'medium',
    seedPrefix: 'ZIP-SEARCH',
    experimentId: null,
    maxNodes: 300000,
    outputDir: defaultOutputDir,
    scorer: 'auto',
    modelMetadataPath: null,
    predictScriptPath: null,
    algorithm: 'random',
    populationSize: 20,
    eliteCount: 5,
    mutationRate: 0.35,
    mutationStrength: 0.16,
    explorationRate: 0.15,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--count') {
      parsed.count = parsePositiveInt(next, '--count');
      index += 1;
    } else if (arg === '--top') {
      parsed.top = parsePositiveInt(next, '--top');
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
    } else if (arg === '--experiment-id') {
      parsed.experimentId = next || parsed.experimentId;
      index += 1;
    } else if (arg === '--max-nodes') {
      parsed.maxNodes = parsePositiveInt(next, '--max-nodes');
      index += 1;
    } else if (arg === '--output-dir') {
      parsed.outputDir = path.resolve(next || parsed.outputDir);
      index += 1;
    } else if (arg === '--scorer') {
      parsed.scorer = parseScorer(next);
      index += 1;
    } else if (arg === '--model-metadata') {
      parsed.modelMetadataPath = path.resolve(next || '');
      index += 1;
    } else if (arg === '--predict-script') {
      parsed.predictScriptPath = path.resolve(next || '');
      index += 1;
    } else if (arg === '--algorithm') {
      parsed.algorithm = parseAlgorithm(next);
      index += 1;
    } else if (arg === '--population-size') {
      parsed.populationSize = parsePositiveInt(next, '--population-size');
      index += 1;
    } else if (arg === '--elite-count') {
      parsed.eliteCount = parsePositiveInt(next, '--elite-count');
      index += 1;
    } else if (arg === '--mutation-rate') {
      parsed.mutationRate = parseRatio(next, '--mutation-rate');
      index += 1;
    } else if (arg === '--mutation-strength') {
      parsed.mutationStrength = parseRatio(next, '--mutation-strength');
      index += 1;
    } else if (arg === '--exploration-rate') {
      parsed.explorationRate = parseRatio(next, '--exploration-rate');
      index += 1;
    } else if (arg === '--help') {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
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
 * @param {string} name
 */
function parseRatio(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${name} must be between 0 and 1.`);
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

/**
 * @param {string | undefined} value
 */
function parseScorer(value) {
  if (value === 'auto' || value === 'bootstrap' || value === 'xgboost') {
    return value;
  }
  throw new Error('--scorer must be auto, bootstrap, or xgboost.');
}

/**
 * @param {string | undefined} value
 */
function parseAlgorithm(value) {
  if (value === 'random' || value === 'evolutionary') {
    return value;
  }
  throw new Error('--algorithm must be random or evolutionary.');
}

function printHelpAndExit() {
  console.log(`Usage: node scripts/experiments/run-iteration.mjs [options]

Options:
  --count <n>           Total candidate evaluations. Default: 100
  --top <n>             Number of candidates to retain. Default: 3
  --rows <n>            Board rows. Default: 6
  --cols <n>            Board columns. Default: 6
  --target <level>      easy, medium, or hard. Default: medium
  --seed-prefix <text>  Seed prefix. Default: ZIP-SEARCH
  --experiment-id <id>  Stable output basename.
  --max-nodes <n>       Solver node cap. Default: 300000
  --output-dir <path>   Output directory. Default: assets/data/experiments
  --scorer <name>        auto, bootstrap, or xgboost. Default: auto
  --model-metadata <p>   XGBoost metadata JSON for auto/xgboost scoring.
  --predict-script <p>   Python prediction script for auto/xgboost scoring.
  --algorithm <name>     random or evolutionary. Default: random
  --population-size <n>  Evolutionary candidates per generation. Default: 20
  --elite-count <n>      Retained parents for evolutionary search. Default: 5
  --mutation-rate <n>    Per-parameter mutation probability, 0-1. Default: 0.35
  --mutation-strength <n> Mutation step size as range fraction, 0-1. Default: 0.16
  --exploration-rate <n> Random offspring probability, 0-1. Default: 0.15
`);
  process.exit(0);
}
