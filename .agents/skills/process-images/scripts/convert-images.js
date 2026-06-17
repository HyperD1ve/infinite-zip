#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildWallSet, hasWallBetween } from '../../../../src/game/board.js';
import { validatePuzzle } from '../../../../src/game/puzzle.js';

const repoRoot = path.join(fileURLToPath(new URL('../../../..', import.meta.url)));
const defaultImageDir = path.join(repoRoot, 'assets', 'data', 'official-images');
const defaultOutputDir = path.join(repoRoot, 'assets', 'data', 'image-puzzles');

const options = parseArgs(process.argv.slice(2));
const pairs = findImagePairs(options.imageDir);
const puzzles = pairs.map((pair) => convertPair(pair));

fs.mkdirSync(options.outputDir, { recursive: true });
for (const puzzle of puzzles) {
  fs.writeFileSync(path.join(options.outputDir, `${puzzle.seed}.json`), `${JSON.stringify(puzzle, null, 2)}\n`);
}
fs.writeFileSync(path.join(options.outputDir, 'puzzles.json'), `${JSON.stringify(puzzles, null, 2)}\n`);

console.log(`Converted ${puzzles.length} puzzle image pairs to ${options.outputDir}`);

/**
 * @param {{ id: string, solved: string, unsolved: string }} pair
 */
function convertPair(pair) {
  let unsolved;
  let solved;
  try {
    unsolved = analyzeUnsolved(loadImage(pair.unsolved));
    solved = analyzeSolved(loadImage(pair.solved), unsolved);
  } catch (error) {
    throw new Error(`${pair.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const pathIndex = new Map(solved.solution.map((cell, index) => [`${cell.row},${cell.col}`, index]));
  const clues = unsolved.clueCells
    .map((cell) => ({ ...cell, pathIndex: pathIndex.get(`${cell.row},${cell.col}`) }))
    .filter((cell) => cell.pathIndex !== undefined)
    .sort((a, b) => a.pathIndex - b.pathIndex)
    .map((cell, index) => ({ number: index + 1, row: cell.row, col: cell.col }));

  const puzzle = {
    rows: unsolved.rows,
    cols: unsolved.cols,
    clues,
    walls: unsolved.walls,
    solution: solved.solution,
    seed: pair.id,
    difficulty: null,
  };

  if (clues.length !== unsolved.clueCells.length) {
    throw new Error(`${pair.id}: only ${clues.length} of ${unsolved.clueCells.length} clue cells landed on the path.`);
  }

  validatePuzzle(puzzle);
  return puzzle;
}

/**
 * @param {ImageData} image
 */
function analyzeUnsolved(image) {
  const xLines = detectGridLines(image, 'x');
  const yLines = detectGridLines(image, 'y');
  const rows = yLines.length - 1;
  const cols = xLines.length - 1;
  const clueCells = detectCircleCells(image, xLines, yLines);
  const startCell = detectStartCell(image, xLines, yLines);
  const walls = detectWalls(image, xLines, yLines);

  if (rows < 3 || cols < 3) {
    throw new Error(`Could not detect grid. Got ${rows} rows and ${cols} cols.`);
  }

  if (!clueCells.some((cell) => sameCell(cell, startCell))) {
    clueCells.push(startCell);
    clueCells.sort((a, b) => a.row - b.row || a.col - b.col);
  }

  return { rows, cols, xLines, yLines, clueCells, startCell, walls };
}

/**
 * @param {ImageData} image
 * @param {{ rows: number, cols: number, clueCells: Cell[], startCell: Cell }} unsolved
 */
function analyzeSolved(image, unsolved) {
  const circles = detectBlackCircles(image);
  const transform = fitSolvedGridTransform(unsolved.clueCells, circles);
  const centers = buildSolvedCenters(unsolved.rows, unsolved.cols, transform);
  const edges = detectSolvedEdges(image, centers, unsolved.rows, unsolved.cols, unsolved.walls);
  const solution = tracePath(unsolved.rows, unsolved.cols, edges, unsolved.startCell);

  return { solution };
}

/**
 * @param {ImageData} image
 * @param {'x' | 'y'} axis
 */
function detectGridLines(image, axis) {
  const length = axis === 'x' ? image.width : image.height;
  const span = axis === 'x' ? image.height : image.width;
  const scores = new Array(length).fill(0);

  for (let major = 0; major < length; major += 1) {
    for (let minor = 0; minor < span; minor += 1) {
      const pixel = axis === 'x' ? image.pixel(major, minor) : image.pixel(minor, major);
      if (isGridPixel(pixel)) {
        scores[major] += 1;
      }
    }
  }

  for (const ratio of [0.28, 0.22, 0.16, 0.1]) {
    const lines = clusterLinePositions(scores, span * ratio);
    if (lines.length >= 4) {
      return normalizeGridLines(lines);
    }
  }

  throw new Error(`Unable to detect ${axis}-axis grid lines.`);
}

/**
 * @param {number[]} scores
 * @param {number} threshold
 */
function clusterLinePositions(scores, threshold) {
  const clusters = [];
  let start = null;
  let total = 0;
  let weight = 0;

  for (let index = 0; index <= scores.length; index += 1) {
    const score = scores[index] ?? 0;
    if (score >= threshold) {
      start ??= index;
      total += index * score;
      weight += score;
    } else if (start !== null) {
      if (index - start >= 1 && weight > 0) {
        clusters.push(total / weight);
      }
      start = null;
      total = 0;
      weight = 0;
    }
  }

  return clusters;
}

/**
 * @param {number[]} lines
 */
function normalizeGridLines(lines) {
  const sorted = [...lines].sort((a, b) => a - b);
  if (sorted.length < 3) {
    return sorted;
  }

  const spacings = [];
  for (let index = 1; index < sorted.length; index += 1) {
    spacings.push(sorted[index] - sorted[index - 1]);
  }
  const medianSpacingValue = median(spacings);

  return fillLargeGridGaps(sorted.filter((line, index) => index === 0 || line - sorted[index - 1] > medianSpacingValue * 0.45));
}

/**
 * @param {number[]} lines
 */
function fillLargeGridGaps(lines) {
  if (lines.length < 3) {
    return lines;
  }

  const spacings = [];
  for (let index = 1; index < lines.length; index += 1) {
    spacings.push(lines[index] - lines[index - 1]);
  }
  const medianSpacingValue = median(spacings);
  const repaired = [lines[0]];

  for (let index = 1; index < lines.length; index += 1) {
    const previous = lines[index - 1];
    const current = lines[index];
    const gap = current - previous;
    const segmentCount = Math.round(gap / medianSpacingValue);

    if (segmentCount > 1 && Math.abs(gap / segmentCount - medianSpacingValue) <= medianSpacingValue * 0.2) {
      for (let segment = 1; segment < segmentCount; segment += 1) {
        repaired.push(previous + (gap * segment) / segmentCount);
      }
    }

    repaired.push(current);
  }

  return repaired;
}

/**
 * @param {ImageData} image
 * @param {number[]} xLines
 * @param {number[]} yLines
 */
function detectCircleCells(image, xLines, yLines) {
  const cells = new Map();

  for (const component of detectBlackCircles(image)) {
    const cell = pointToCell(component.cx, component.cy, xLines, yLines);
    if (cell) {
      cells.set(`${cell.row},${cell.col}`, cell);
    }
  }

  return [...cells.values()].sort((a, b) => a.row - b.row || a.col - b.col);
}

/**
 * @param {ImageData} image
 */
function detectBlackCircles(image) {
  const visited = new Uint8Array(image.width * image.height);
  const components = [];

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const startIndex = y * image.width + x;
      if (visited[startIndex] || !isBlackPixel(image.pixel(x, y))) {
        continue;
      }

      const component = floodBlackComponent(image, x, y, visited);
      const width = component.maxX - component.minX + 1;
      const height = component.maxY - component.minY + 1;
      const aspect = width / height;

      if (
        width >= 32
        && width <= 78
        && height >= 32
        && height <= 78
        && aspect >= 0.68
        && aspect <= 1.45
        && component.area >= 650
      ) {
        components.push({
          ...component,
          width,
          height,
          cx: component.sumX / component.area,
          cy: component.sumY / component.area,
        });
      }
    }
  }

  return components;
}

/**
 * @param {ImageData} image
 * @param {number} startX
 * @param {number} startY
 * @param {Uint8Array} visited
 */
function floodBlackComponent(image, startX, startY, visited) {
  const queue = [{ x: startX, y: startY }];
  visited[startY * image.width + startX] = 1;
  const component = { minX: startX, maxX: startX, minY: startY, maxY: startY, area: 0, sumX: 0, sumY: 0 };

  for (let head = 0; head < queue.length; head += 1) {
    const point = queue[head];
    component.area += 1;
    component.sumX += point.x;
    component.sumY += point.y;
    component.minX = Math.min(component.minX, point.x);
    component.maxX = Math.max(component.maxX, point.x);
    component.minY = Math.min(component.minY, point.y);
    component.maxY = Math.max(component.maxY, point.y);

    for (const next of [
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 },
    ]) {
      if (next.x < 0 || next.x >= image.width || next.y < 0 || next.y >= image.height) {
        continue;
      }

      const index = next.y * image.width + next.x;
      if (!visited[index] && isBlackPixel(image.pixel(next.x, next.y))) {
        visited[index] = 1;
        queue.push(next);
      }
    }
  }

  return component;
}

/**
 * @param {ImageData} image
 * @param {number[]} xLines
 * @param {number[]} yLines
 */
function detectStartCell(image, xLines, yLines) {
  let best = { density: 0, cell: null };

  for (let row = 0; row < yLines.length - 1; row += 1) {
    for (let col = 0; col < xLines.length - 1; col += 1) {
      const density = sampleCellDensity(image, xLines, yLines, row, col, isStartHighlightPixel);
      if (density > best.density) {
        best = { density, cell: { row, col } };
      }
    }
  }

  if (!best.cell || best.density < 0.02) {
    throw new Error(`Could not detect highlighted clue 1 cell. Best density was ${best.density.toFixed(4)} at ${JSON.stringify(best.cell)}.`);
  }

  return best.cell;
}

/**
 * @param {ImageData} image
 * @param {number[]} xLines
 * @param {number[]} yLines
 */
function detectWalls(image, xLines, yLines) {
  const walls = [];
  const rows = yLines.length - 1;
  const cols = xLines.length - 1;

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (sampleBoundaryDensity(image, xLines, yLines, row, col, 'horizontal') > 0.18) {
        walls.push({ a: { row, col }, b: { row: row + 1, col } });
      }
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      if (sampleBoundaryDensity(image, xLines, yLines, row, col, 'vertical') > 0.18) {
        walls.push({ a: { row, col }, b: { row, col: col + 1 } });
      }
    }
  }

  return walls;
}

/**
 * @param {Cell[]} clueCells
 * @param {{ cx: number, cy: number }[]} solvedCircles
 */
function fitSolvedGridTransform(clueCells, solvedCircles) {
  let best = null;

  for (const firstCell of clueCells) {
    for (const secondCell of clueCells) {
      if (firstCell === secondCell || firstCell.col === secondCell.col || firstCell.row === secondCell.row) {
        continue;
      }

      for (const firstCircle of solvedCircles) {
        for (const secondCircle of solvedCircles) {
          if (firstCircle === secondCircle) {
            continue;
          }

          const scaleX = (secondCircle.cx - firstCircle.cx) / (secondCell.col - firstCell.col);
          const scaleY = (secondCircle.cy - firstCircle.cy) / (secondCell.row - firstCell.row);
          if (scaleX <= 20 || scaleY <= 20 || !Number.isFinite(scaleX) || !Number.isFinite(scaleY)) {
            continue;
          }

          const left = firstCircle.cx - (firstCell.col + 0.5) * scaleX;
          const top = firstCircle.cy - (firstCell.row + 0.5) * scaleY;
          const fit = scoreTransform(clueCells, solvedCircles, { left, top, scaleX, scaleY });
          if (!best || fit.matches > best.matches || fit.matches === best.matches && fit.error < best.error) {
            best = { left, top, scaleX, scaleY, ...fit };
          }
        }
      }
    }
  }

  if (!best || best.matches < Math.max(3, Math.floor(clueCells.length * 0.7))) {
    throw new Error(`Could not align solved image to grid. Matched ${best?.matches ?? 0} clue circles.`);
  }

  return best;
}

/**
 * @param {Cell[]} clueCells
 * @param {{ cx: number, cy: number }[]} circles
 * @param {{ left: number, top: number, scaleX: number, scaleY: number }} transform
 */
function scoreTransform(clueCells, circles, transform) {
  const tolerance = Math.min(transform.scaleX, transform.scaleY) * 0.33;
  const used = new Set();
  let matches = 0;
  let error = 0;

  for (const cell of clueCells) {
    const predicted = solvedCenter(transform, cell);
    let best = null;

    for (let index = 0; index < circles.length; index += 1) {
      if (used.has(index)) {
        continue;
      }
      const circle = circles[index];
      const distance = Math.hypot(circle.cx - predicted.x, circle.cy - predicted.y);
      if (distance <= tolerance && (!best || distance < best.distance)) {
        best = { index, distance };
      }
    }

    if (best) {
      used.add(best.index);
      matches += 1;
      error += best.distance;
    } else {
      error += tolerance * 4;
    }
  }

  return { matches, error };
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {{ left: number, top: number, scaleX: number, scaleY: number }} transform
 */
function buildSolvedCenters(rows, cols, transform) {
  const centers = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      centers.push({ row, col, ...solvedCenter(transform, { row, col }) });
    }
  }

  return centers;
}

/**
 * @param {{ left: number, top: number, scaleX: number, scaleY: number }} transform
 * @param {Cell} cell
 */
function solvedCenter(transform, cell) {
  return {
    x: transform.left + (cell.col + 0.5) * transform.scaleX,
    y: transform.top + (cell.row + 0.5) * transform.scaleY,
  };
}

/**
 * @param {ImageData} image
 * @param {{ row: number, col: number, x: number, y: number }[]} centers
 * @param {number} rows
 * @param {number} cols
 * @param {import('../../../../src/types/index.js').Wall[]} walls
 */
function detectSolvedEdges(image, centers, rows, cols, walls) {
  const centerByKey = new Map(centers.map((center) => [`${center.row},${center.col}`, center]));
  const wallSet = buildWallSet(walls);
  const edges = new Map();

  function add(a, b, score) {
    const aKey = `${a.row},${a.col}`;
    const bKey = `${b.row},${b.col}`;
    if (!edges.has(aKey)) {
      edges.set(aKey, []);
    }
    if (!edges.has(bKey)) {
      edges.set(bKey, []);
    }
    edges.get(aKey).push({ row: b.row, col: b.col, score });
    edges.get(bKey).push({ row: a.row, col: a.col, score });
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const current = centerByKey.get(`${row},${col}`);

      if (col + 1 < cols) {
        const next = centerByKey.get(`${row},${col + 1}`);
        const score = sampleConnectorDensity(image, current, next);
        if (score > 0.22 && !hasWallBetween(wallSet, current, next)) {
          add(current, next, score);
        }
      }

      if (row + 1 < rows) {
        const next = centerByKey.get(`${row + 1},${col}`);
        const score = sampleConnectorDensity(image, current, next);
        if (score > 0.22 && !hasWallBetween(wallSet, current, next)) {
          add(current, next, score);
        }
      }
    }
  }

  return edges;
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Map<string, (Cell & { score: number })[]>} edges
 * @param {Cell} startCell
 */
function tracePath(rows, cols, edges, startCell) {
  const total = rows * cols;
  const startKey = `${startCell.row},${startCell.col}`;
  const path = [startCell];
  const visited = new Set([startKey]);
  let explored = 0;
  const maxExplored = 250000;

  /**
   * @param {Cell} current
   * @param {string | null} previous
   */
  function search(current, previous) {
    explored += 1;
    if (explored > maxExplored) {
      return false;
    }

    if (path.length === total) {
      return true;
    }

    const currentKey = `${current.row},${current.col}`;
    const candidates = (edges.get(currentKey) ?? []).filter((cell) => {
      const key = `${cell.row},${cell.col}`;
      return key !== previous && !visited.has(key);
    }).sort((a, b) => b.score - a.score);

    for (const next of candidates) {
      const key = `${next.row},${next.col}`;
      visited.add(key);
      path.push({ row: next.row, col: next.col });

      if (search(next, currentKey)) {
        return true;
      }

      path.pop();
      visited.delete(key);
    }

    return false;
  }

  if (!search(startCell, null)) {
    throw new Error(`Could not trace solved path from ${startKey}; searched ${explored} states.`);
  }

  return path;
}

/**
 * @param {ImageData} image
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 */
function sampleConnectorDensity(image, a, b) {
  const cellScale = Math.hypot(a.x - b.x, a.y - b.y);
  const half = Math.max(7, Math.round(cellScale * 0.18));
  const cx = Math.round((a.x + b.x) / 2);
  const cy = Math.round((a.y + b.y) / 2);
  let total = 0;
  let pathPixels = 0;

  for (let y = cy - half; y <= cy + half; y += 1) {
    for (let x = cx - half; x <= cx + half; x += 1) {
      if (x < 0 || x >= image.width || y < 0 || y >= image.height) {
        continue;
      }
      total += 1;
      if (isPathPixel(image.pixel(x, y))) {
        pathPixels += 1;
      }
    }
  }

  return total === 0 ? 0 : pathPixels / total;
}

/**
 * @param {ImageData} image
 * @param {number[]} xLines
 * @param {number[]} yLines
 * @param {number} row
 * @param {number} col
 * @param {'horizontal' | 'vertical'} orientation
 */
function sampleBoundaryDensity(image, xLines, yLines, row, col, orientation) {
  const cellWidth = medianSpacing(xLines);
  const cellHeight = medianSpacing(yLines);
  const strip = Math.max(6, Math.round(Math.min(cellWidth, cellHeight) * 0.12));
  const pad = Math.round(Math.min(cellWidth, cellHeight) * 0.18);
  let x1;
  let x2;
  let y1;
  let y2;

  if (orientation === 'horizontal') {
    const y = Math.round(yLines[row + 1]);
    x1 = Math.round(xLines[col] + pad);
    x2 = Math.round(xLines[col + 1] - pad);
    y1 = y - strip;
    y2 = y + strip;
  } else {
    const x = Math.round(xLines[col + 1]);
    x1 = x - strip;
    x2 = x + strip;
    y1 = Math.round(yLines[row] + pad);
    y2 = Math.round(yLines[row + 1] - pad);
  }

  let total = 0;
  let black = 0;
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) {
      if (x < 0 || x >= image.width || y < 0 || y >= image.height) {
        continue;
      }
      total += 1;
      if (isBlackPixel(image.pixel(x, y))) {
        black += 1;
      }
    }
  }

  return total === 0 ? 0 : black / total;
}

/**
 * @param {ImageData} image
 * @param {number[]} xLines
 * @param {number[]} yLines
 * @param {number} row
 * @param {number} col
 * @param {(pixel: Pixel) => boolean} predicate
 */
function sampleCellDensity(image, xLines, yLines, row, col, predicate) {
  const padX = Math.round((xLines[col + 1] - xLines[col]) * 0.12);
  const padY = Math.round((yLines[row + 1] - yLines[row]) * 0.12);
  let total = 0;
  let matches = 0;

  for (let y = Math.round(yLines[row] + padY); y <= Math.round(yLines[row + 1] - padY); y += 1) {
    for (let x = Math.round(xLines[col] + padX); x <= Math.round(xLines[col + 1] - padX); x += 1) {
      total += 1;
      if (predicate(image.pixel(x, y))) {
        matches += 1;
      }
    }
  }

  return total === 0 ? 0 : matches / total;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number[]} xLines
 * @param {number[]} yLines
 */
function pointToCell(x, y, xLines, yLines) {
  const col = intervalIndex(x, xLines);
  const row = intervalIndex(y, yLines);
  return row === -1 || col === -1 ? null : { row, col };
}

/**
 * @param {number} value
 * @param {number[]} lines
 */
function intervalIndex(value, lines) {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (value >= lines[index] && value <= lines[index + 1]) {
      return index;
    }
  }
  return -1;
}

/**
 * @param {Pixel} pixel
 */
function isGridPixel(pixel) {
  const max = Math.max(pixel.r, pixel.g, pixel.b);
  const min = Math.min(pixel.r, pixel.g, pixel.b);
  const avg = (pixel.r + pixel.g + pixel.b) / 3;
  return pixel.a > 200 && max - min < 10 && avg >= 120 && avg <= 185;
}

/**
 * @param {Pixel} pixel
 */
function isBlackPixel(pixel) {
  return pixel.a > 200 && pixel.r < 55 && pixel.g < 55 && pixel.b < 55;
}

/**
 * @param {Pixel} pixel
 */
function isStartHighlightPixel(pixel) {
  const max = Math.max(pixel.r, pixel.g, pixel.b);
  const min = Math.min(pixel.r, pixel.g, pixel.b);
  const avg = (pixel.r + pixel.g + pixel.b) / 3;
  return pixel.a > 200 && avg > 105 && max - min > 25 && !isBlackPixel(pixel) && !isGridPixel(pixel);
}

/**
 * @param {Pixel} pixel
 */
function isPathPixel(pixel) {
  const max = Math.max(pixel.r, pixel.g, pixel.b);
  const min = Math.min(pixel.r, pixel.g, pixel.b);
  const avg = (pixel.r + pixel.g + pixel.b) / 3;
  return pixel.a > 200 && max > 115 && avg > 42 && max - min > 35 && !isBlackPixel(pixel) && !isGridPixel(pixel);
}

/**
 * @param {string} imagePath
 */
function loadImage(imagePath) {
  const [width, height] = execFileSync('identify', ['-format', '%w %h', imagePath], { encoding: 'utf8' })
    .trim()
    .split(/\s+/)
    .map(Number);
  const data = execFileSync('magick', [imagePath, '-depth', '8', 'rgba:-'], {
    maxBuffer: width * height * 4 + 1024,
  });

  return {
    width,
    height,
    data,
    pixel(x, y) {
      const offset = (y * width + x) * 4;
      return { r: data[offset], g: data[offset + 1], b: data[offset + 2], a: data[offset + 3] };
    },
  };
}

/**
 * @param {string} imageDir
 */
function findImagePairs(imageDir) {
  const files = fs.readdirSync(imageDir);
  const ids = new Set();

  for (const file of files) {
    const match = file.match(/^(.+)-(?:solved|unsolved)\.png$/);
    if (match) {
      ids.add(match[1]);
    }
  }

  return [...ids].sort().map((id) => {
    const solved = path.join(imageDir, `${id}-solved.png`);
    const unsolved = path.join(imageDir, `${id}-unsolved.png`);
    if (!fs.existsSync(solved) || !fs.existsSync(unsolved)) {
      throw new Error(`Missing solved/unsolved pair for ${id}.`);
    }
    return { id, solved, unsolved };
  });
}

/**
 * @param {string[]} args
 */
function parseArgs(args) {
  const parsed = { imageDir: defaultImageDir, outputDir: defaultOutputDir };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--image-dir') {
      parsed.imageDir = path.resolve(next);
      index += 1;
    } else if (arg === '--output-dir') {
      parsed.outputDir = path.resolve(next);
      index += 1;
    } else if (arg === '--help') {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function printHelpAndExit() {
  console.log(`Usage: node .agents/skills/process-images/scripts/convert-images.js [options]

Options:
  --image-dir <path>   Directory containing *-solved.png and *-unsolved.png pairs.
  --output-dir <path>  Directory to receive Puzzle JSON files. Default: assets/data/image-puzzles
`);
  process.exit(0);
}

/**
 * @param {number[]} values
 */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * @param {number[]} lines
 */
function medianSpacing(lines) {
  const spacings = [];
  for (let index = 1; index < lines.length; index += 1) {
    spacings.push(lines[index] - lines[index - 1]);
  }
  return median(spacings);
}

/**
 * @param {Cell} a
 * @param {Cell} b
 */
function sameCell(a, b) {
  return a.row === b.row && a.col === b.col;
}

/**
 * @typedef {{ row: number, col: number }} Cell
 * @typedef {{ r: number, g: number, b: number, a: number }} Pixel
 * @typedef {{ width: number, height: number, data: Buffer, pixel(x: number, y: number): Pixel }} ImageData
 */
