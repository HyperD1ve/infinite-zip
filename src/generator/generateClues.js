/**
 * @import { Clue, SolutionPath } from '../types/index.js'
 */

import { randomInt } from './random.js';

/**
 * @param {SolutionPath} path
 * @param {number} clueCount
 */
export function selectDistributedClueIndices(path, clueCount) {
  const total = path.length;
  const desired = Math.max(2, Math.min(total, clueCount));
  const indices = new Set([0, total - 1]);

  for (let clue = 1; clue < desired - 1; clue += 1) {
    indices.add(Math.round((clue / (desired - 1)) * (total - 1)));
  }

  while (indices.size < desired) {
    indices.add(findLargestGapMidpoint([...indices], total));
  }

  return [...indices].sort((a, b) => a - b);
}

/**
 * @param {SolutionPath} path
 * @param {number} clueCount
 * @param {number} clueSpacingBias
 * @param {() => number} rng
 */
export function selectParameterizedClueIndices(path, clueCount, clueSpacingBias, rng) {
  const total = path.length;
  const desired = Math.max(2, Math.min(total, clueCount));
  const indices = new Set([0, total - 1]);
  const spacing = (total - 1) / Math.max(1, desired - 1);
  const jitterRadius = Math.floor(spacing * (1 - clueSpacingBias) * 0.48);

  for (let clue = 1; clue < desired - 1; clue += 1) {
    const ideal = Math.round(clue * spacing);
    const jitter = jitterRadius > 0 ? randomInt(rng, -jitterRadius, jitterRadius + 1) : 0;
    indices.add(Math.max(1, Math.min(total - 2, ideal + jitter)));
  }

  while (indices.size < desired) {
    indices.add(findLargestGapMidpoint([...indices], total));
  }

  return [...indices].sort((a, b) => a - b);
}

/**
 * @param {SolutionPath} path
 * @param {number[]} indices
 * @returns {Clue[]}
 */
export function buildCluesFromPath(path, indices) {
  return [...new Set(indices)]
    .sort((a, b) => a - b)
    .map((pathIndex, clueIndex) => {
      const cell = path[pathIndex];
      return {
        number: clueIndex + 1,
        row: cell.row,
        col: cell.col,
      };
    });
}

/**
 * @param {number[]} indices
 * @param {number} total
 */
export function addClueInLargestGap(indices, total) {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  if (sorted.length >= total) {
    return sorted;
  }

  sorted.push(findLargestGapMidpoint(sorted, total));
  return [...new Set(sorted)].sort((a, b) => a - b);
}

/**
 * @param {number[]} indices
 * @param {number} total
 */
function findLargestGapMidpoint(indices, total) {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  let bestStart = 0;
  let bestEnd = total - 1;
  let bestGap = -1;

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    const gap = end - start;
    if (gap > bestGap) {
      bestGap = gap;
      bestStart = start;
      bestEnd = end;
    }
  }

  return Math.floor((bestStart + bestEnd) / 2);
}
