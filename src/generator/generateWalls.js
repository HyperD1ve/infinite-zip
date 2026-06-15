import { wallKey } from '../game/board.js';
import { createRng, shuffled } from './random.js';

/**
 * @param {number} rows
 * @param {number} cols
 * @param {import('../types/index.js').SolutionPath} solution
 * @param {string} seed
 * @param {number} wallDensity
 */
export function generateWalls(rows, cols, solution, seed, wallDensity = 0.16) {
  const rng = createRng(`walls:${rows}x${cols}:${seed}:${wallDensity.toFixed(3)}`);
  const solutionEdges = new Set();

  for (let index = 1; index < solution.length; index += 1) {
    solutionEdges.add(wallKey(solution[index - 1], solution[index]));
  }

  const candidates = allPossibleWalls(rows, cols)
    .filter((wall) => !solutionEdges.has(wallKey(wall.a, wall.b)));
  const wallCount = Math.min(candidates.length, Math.round(candidates.length * wallDensity));

  return shuffled(candidates, rng)
    .slice(0, wallCount)
    .sort((first, second) => wallKey(first.a, first.b).localeCompare(wallKey(second.a, second.b)));
}

/**
 * @param {number} rows
 * @param {number} cols
 */
function allPossibleWalls(rows, cols) {
  const walls = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (col + 1 < cols) {
        walls.push({ a: { row, col }, b: { row, col: col + 1 } });
      }
      if (row + 1 < rows) {
        walls.push({ a: { row, col }, b: { row: row + 1, col } });
      }
    }
  }

  return walls;
}
