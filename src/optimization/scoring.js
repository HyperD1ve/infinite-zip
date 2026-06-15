export const SCORE_COLUMNS = [
  'scorer_name',
  'predicted_quality_score',
  'ranking_score',
];

/**
 * This is a framework bootstrap scorer, not the final learned quality model.
 * Replace this seam with an XGBoost-backed scorer once labeled feedback exists.
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
