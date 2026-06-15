/**
 * @param {{
 *   rows: number,
 *   cols: number,
 *   clueCount: number,
 *   stats: { nodesVisited: number, backtracks: number, branchingEvents: number, branchChoices: number }
 * }} input
 */
export function rateDifficulty(input) {
  const cells = input.rows * input.cols;
  const clueDensity = input.clueCount / cells;
  const averageBranchingFactor = input.stats.branchingEvents === 0
    ? 0
    : input.stats.branchChoices / input.stats.branchingEvents;
  const searchPressure = input.stats.nodesVisited / cells
    + input.stats.backtracks * 0.15
    + input.stats.branchingEvents * 0.4
    + averageBranchingFactor;
  const score = searchPressure * (1 - clueDensity);

  if (score < 8) {
    return 'Easy';
  }
  if (score < 24) {
    return 'Medium';
  }
  if (score < 60) {
    return 'Hard';
  }
  return 'Expert';
}
