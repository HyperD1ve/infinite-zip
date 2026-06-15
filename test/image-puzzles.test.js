import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import { validateSolutionPath } from '../src/game/board.js';
import { validatePuzzle } from '../src/game/puzzle.js';

test('processed image puzzles are valid Puzzle objects', () => {
  const puzzles = JSON.parse(fs.readFileSync('assets/data/image-puzzles/puzzles.json', 'utf8'));

  assert.equal(puzzles.length, 5);

  for (const puzzle of puzzles) {
    assert.equal(validatePuzzle(puzzle), true);
    assert.equal(validateSolutionPath(puzzle.rows, puzzle.cols, puzzle.solution, puzzle.walls).valid, true);
    assert.equal(puzzle.clues[0].number, 1);
    assert.equal(puzzle.clues[puzzle.clues.length - 1].number, puzzle.clues.length);
  }
});
