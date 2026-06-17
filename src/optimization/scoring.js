import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCORE_COLUMNS = [
  'scorer_name',
  'predicted_quality_score',
  'ranking_score',
];

const repoRoot = path.join(fileURLToPath(new URL('../..', import.meta.url)));
const defaultPredictScript = path.join(repoRoot, 'scripts', 'model', 'predict_quality.py');
const defaultModelMetadata = path.join(repoRoot, 'models', 'puzzle_quality-metadata.json');

/**
 * Score a batch of generated candidates. In `auto` mode this uses the local
 * XGBoost artifact when available, then falls back to the bootstrap scorer.
 *
 * @param {Record<string, unknown>[]} featureRows
 * @param {{
 *   scorer?: 'auto' | 'bootstrap' | 'xgboost',
 *   modelMetadataPath?: string,
 *   predictScriptPath?: string
 * }} options
 */
export function scoreCandidates(featureRows, options = {}) {
  const scorer = options.scorer ?? 'auto';
  if (scorer !== 'bootstrap') {
    try {
      return scoreWithXgboost(featureRows, options);
    } catch (error) {
      if (scorer === 'xgboost') {
        throw error;
      }
    }
  }

  return featureRows.map((featureRow) => scoreCandidate(featureRow));
}

/**
 * This is a framework bootstrap scorer, not the final learned quality model.
 * It remains as a fallback before an XGBoost artifact has been trained.
 *
 * @param {Record<string, unknown>} featureRow
 */
export function scoreCandidate(featureRow) {
  const solverLoad = normalize(Number(featureRow.solver_nodes_visited), 0, 100000);
  const branching = normalize(Number(featureRow.average_branching_factor), 1, 3);
  const wallDensity = normalize(Number(featureRow.wall_density), 0, 0.35);
  const clueDensity = Number(featureRow.clues) / Math.max(1, Number(featureRow.rows) * Number(featureRow.cols));
  const clueBalance = 1 - Math.abs(clueDensity - 0.22) / 0.22;
  const symmetry = Number(featureRow.overall_symmetry) || 0;

  const rankingScore = bounded(
    solverLoad * 0.22
    + branching * 0.18
    + wallDensity * 0.18
    + bounded(clueBalance) * 0.22
    + symmetry * 0.2,
  );

  return {
    scorer_name: 'bootstrap_exploration_v0',
    predicted_quality_score: '',
    ranking_score: rankingScore,
  };
}

/**
 * @param {Record<string, unknown>[]} featureRows
 * @param {{ modelMetadataPath?: string, predictScriptPath?: string }} options
 */
function scoreWithXgboost(featureRows, options) {
  const metadataPath = path.resolve(options.modelMetadataPath ?? defaultModelMetadata);
  const scriptPath = path.resolve(options.predictScriptPath ?? defaultPredictScript);

  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Model metadata not found: ${metadataPath}`);
  }
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Prediction script not found: ${scriptPath}`);
  }

  const output = execFileSync('python3', [scriptPath, '--metadata', metadataPath], {
    encoding: 'utf8',
    input: `${JSON.stringify(featureRows)}\n`,
    maxBuffer: 1024 * 1024 * 16,
  });
  const rows = JSON.parse(output);

  if (!Array.isArray(rows) || rows.length !== featureRows.length) {
    throw new Error(`XGBoost scorer returned ${Array.isArray(rows) ? rows.length : 'non-array'} rows for ${featureRows.length} candidates.`);
  }

  return rows.map((row) => ({
    scorer_name: row.scorer_name ?? 'xgboost_model_v0',
    predicted_quality_score: Number(row.predicted_quality_score),
    ranking_score: Number(row.ranking_score),
  }));
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function normalize(value, min, max) {
  if (!Number.isFinite(value) || max <= min) {
    return 0;
  }
  return bounded((value - min) / (max - min));
}

/**
 * @param {number} value
 */
function bounded(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
