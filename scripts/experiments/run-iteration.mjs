#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CSV_COLUMNS, extractPuzzleStatistics } from '../../.agents/skills/collect-statistics/scripts/features.js';
import { writeCsv } from '../../.agents/skills/collect-statistics/scripts/csv.js';
import { generatePuzzle } from '../../src/generator/puzzle.js';
import { generatorParameterRow, sampleGeneratorParameters } from '../../src/generator/parameters.js';
import { countSolutions } from '../../src/solver/solve.js';
import { SCORE_COLUMNS, scoreCandidates } from '../../src/optimization/scoring.js';

const repoRoot = path.join(fileURLToPath(new URL('../..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'assets', 'data', 'experiments');
const options = parseArgs(process.argv.slice(2));
const experimentId = options.experimentId ?? `${options.seedPrefix}-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`;

const historyRows = [];
const candidateRecords = [];

for (let index = 0; index < options.count; index += 1) {
  const seed = `${options.seedPrefix}-${String(index + 1).padStart(5, '0')}`;
  const parameters = sampleGeneratorParameters(seed);

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
      generation_status: solveResult.solutionCount === 1 && !solveResult.limitHit ? 'valid_unique' : 'solver_rejected',
      ...featureRow,
      ...generatorParameterRow(parameters),
    };

    historyRows.push(row);
    candidateRecords.push({ row, puzzle });
  } catch (error) {
    historyRows.push({
      experiment_id: experimentId,
      generation_status: 'generation_failed',
      id: seed,
      ...generatorParameterRow(parameters),
      scorer_name: 'none',
      predicted_quality_score: '',
      ranking_score: '',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const scoreableRecords = candidateRecords.filter((record) => record.row.generation_status !== 'generation_failed');
if (scoreableRecords.length > 0) {
  const scores = scoreCandidates(scoreableRecords.map((record) => record.row), {
    scorer: options.scorer,
    modelMetadataPath: options.modelMetadataPath,
    predictScriptPath: options.predictScriptPath,
  });

  for (let index = 0; index < scoreableRecords.length; index += 1) {
    Object.assign(scoreableRecords[index].row, scores[index]);
  }
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
    featureRow: record.row,
    puzzle: record.puzzle,
  })), null, 2)}\n`,
);

console.log(`Experiment ${experimentId}`);
console.log(`Wrote history: ${historyPath}`);
console.log(`Wrote top ${ranked.length}: ${candidatesPath}`);

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

function printHelpAndExit() {
  console.log(`Usage: node scripts/experiments/run-iteration.mjs [options]

Options:
  --count <n>           Random parameter samples. Default: 100
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
`);
  process.exit(0);
}
