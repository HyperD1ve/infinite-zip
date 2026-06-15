import fs, { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CSV_COLUMNS, extractPuzzleStatistics } from '../.agents/skills/collect-statistics/scripts/features.js';
import { toCsv } from '../.agents/skills/collect-statistics/scripts/csv.js';
import { countSolutions } from '../src/solver/solve.js';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 5173);
const feedbackPath = join(root, 'assets', 'data', 'feedback', 'human-feedback.csv');
const statisticsPath = join(root, 'assets', 'data', 'zip-statistics.csv');
const feedbackColumns = [
  'puzzle_id',
  'enjoyment_score',
  'difficulty_rating',
  'hint_count',
  'solve_time_seconds',
  'completed',
];

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

  if (request.method === 'POST' && url.pathname === '/api/feedback') {
    handleFeedbackPost(request, response);
    return;
  }

  const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const normalizedPath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(root, normalizedPath);

  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'content-type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
});

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 */
async function handleFeedbackPost(request, response) {
  try {
    const body = await readJsonBody(request);
    const record = normalizeFeedbackRecord(body.feedback);
    const featureRow = body.featureRow ?? buildFeatureRow(body.puzzle, record);

    upsertCsvRow(feedbackPath, feedbackColumns, record, 'puzzle_id');
    upsertCsvRow(statisticsPath, CSV_COLUMNS, statisticsRowFromFeedback(featureRow, record), 'id');

    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true, feedbackPath: relativePath(feedbackPath), statisticsPath: relativePath(statisticsPath) }));
  } catch (error) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  }
}

/**
 * @param {import('node:http').IncomingMessage} request
 */
function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Request body is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Request body must be JSON.'));
      }
    });
    request.on('error', reject);
  });
}

/**
 * @param {Record<string, unknown>} record
 */
function normalizeFeedbackRecord(record) {
  if (!record || typeof record !== 'object') {
    throw new Error('Missing feedback record.');
  }

  const puzzleId = String(record.puzzle_id ?? '').trim();
  if (!puzzleId) {
    throw new Error('Feedback requires puzzle_id.');
  }

  return {
    puzzle_id: puzzleId,
    enjoyment_score: String(record.enjoyment_score ?? ''),
    difficulty_rating: String(record.difficulty_rating ?? ''),
    hint_count: String(record.hint_count ?? ''),
    solve_time_seconds: String(record.solve_time_seconds ?? ''),
    completed: String(record.completed ?? ''),
  };
}

/**
 * @param {import('../src/types/index.js').Puzzle | undefined} puzzle
 * @param {Record<string, string>} record
 */
function buildFeatureRow(puzzle, record) {
  if (!puzzle) {
    throw new Error('Feedback requires either featureRow or puzzle.');
  }

  const solveResult = countSolutions(
    { rows: puzzle.rows, cols: puzzle.cols, clues: puzzle.clues, walls: puzzle.walls },
    { maxSolutions: 2, maxNodes: 1_000_000 },
  );
  return extractPuzzleStatistics(puzzle, solveResult, { id: record.puzzle_id });
}

/**
 * @param {Record<string, unknown>} featureRow
 * @param {Record<string, string>} feedback
 */
function statisticsRowFromFeedback(featureRow, feedback) {
  return {
    ...featureRow,
    id: feedback.puzzle_id,
    player_solve_rate: feedback.completed === 'true' ? 1 : 0,
    player_avg_time: feedback.solve_time_seconds,
    player_hint_rate: feedback.hint_count,
    player_like_score: feedback.enjoyment_score,
  };
}

/**
 * @param {string} filePath
 * @param {string[]} columns
 * @param {Record<string, unknown>} row
 * @param {string} keyColumn
 */
function upsertCsvRow(filePath, columns, row, keyColumn) {
  fs.mkdirSync(join(filePath, '..'), { recursive: true });
  const rows = existsSync(filePath) ? readCsv(filePath) : [];
  const key = String(row[keyColumn] ?? '');
  const nextRows = [
    ...rows.filter((existing) => String(existing[keyColumn] ?? '') !== key),
    row,
  ];
  fs.writeFileSync(filePath, `${toCsv(nextRows, columns)}\n`);
}

/**
 * @param {string} filePath
 */
function readCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) {
    return [];
  }

  const lines = text.split(/\r?\n/);
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

/**
 * @param {string} filePath
 */
function relativePath(filePath) {
  return relative(root, filePath);
}

server.listen(port, () => {
  console.log(`Infinite Zip running at http://localhost:${port}`);
});
