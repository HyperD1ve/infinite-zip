#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeCsv } from '../../.agents/skills/collect-statistics/scripts/csv.js';

const repoRoot = path.join(fileURLToPath(new URL('../..', import.meta.url)));
const defaultStats = path.join(repoRoot, 'assets', 'data', 'puzzles-statistics.csv');
const defaultFeedback = path.join(repoRoot, 'assets', 'data', 'feedback', 'official-linkedin-feedback.csv');
const defaultOutput = path.join(repoRoot, 'assets', 'data', 'training', 'official-linkedin-training.csv');

const options = parseArgs(process.argv.slice(2));
const statsRows = readCsv(options.stats);
const feedbackRows = readCsv(options.feedback);
const feedbackByPuzzle = new Map(feedbackRows.map((row) => [row.puzzle_id, row]));
const trainingRows = statsRows
  .filter((row) => feedbackByPuzzle.has(row.id))
  .map((row) => {
    const feedback = feedbackByPuzzle.get(row.id);
    return {
      puzzle_id: row.id,
      ...row,
      enjoyment_score: feedback.enjoyment_score,
      difficulty_rating: feedback.difficulty_rating,
      hint_count: feedback.hint_count,
      solve_time_seconds: feedback.solve_time_seconds,
      completed: feedback.completed,
    };
  });

if (trainingRows.length === 0) {
  throw new Error('No matching puzzle IDs between statistics and feedback CSVs.');
}

const columns = [
  'puzzle_id',
  ...Object.keys(statsRows[0]).filter((column) => column !== 'id'),
  'enjoyment_score',
  'difficulty_rating',
  'hint_count',
  'solve_time_seconds',
  'completed',
];

writeCsv(options.output, trainingRows, columns);
console.log(`Wrote ${trainingRows.length} training rows to ${options.output}`);

/**
 * @param {string[]} args
 */
function parseArgs(args) {
  const parsed = {
    stats: defaultStats,
    feedback: defaultFeedback,
    output: defaultOutput,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--stats') {
      parsed.stats = path.resolve(next);
      index += 1;
    } else if (arg === '--feedback') {
      parsed.feedback = path.resolve(next);
      index += 1;
    } else if (arg === '--output') {
      parsed.output = path.resolve(next);
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
 * @param {string} filePath
 */
function readCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  const columns = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? '']));
  });
}

/**
 * @param {string} line
 */
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (quoted && char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function printHelpAndExit() {
  console.log(`Usage: node scripts/experiments/build-training-dataset.mjs [options]

Options:
  --stats <path>     Feature/statistics CSV. Default: assets/data/puzzles-statistics.csv
  --feedback <path>  Human feedback CSV. Default: assets/data/feedback/official-linkedin-feedback.csv
  --output <path>    Joined training CSV. Default: assets/data/training/official-linkedin-training.csv
`);
  process.exit(0);
}
