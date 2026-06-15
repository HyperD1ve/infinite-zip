import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createFeedbackRecord, feedbackToCsv } from '../src/ui/feedback.js';

test('feedback records export to the human evaluation CSV schema', () => {
  const record = createFeedbackRecord({
    puzzleId: 'ZIP-1',
    enjoymentScore: 7,
    difficultyRating: 'hard',
    hintCount: 2,
    solveTimeSeconds: 181,
    completed: true,
  });

  assert.deepEqual(record, {
    puzzle_id: 'ZIP-1',
    enjoyment_score: 7,
    difficulty_rating: 'hard',
    hint_count: 2,
    solve_time_seconds: 181,
    completed: true,
  });

  assert.equal(
    feedbackToCsv([record]),
    'puzzle_id,enjoyment_score,difficulty_rating,hint_count,solve_time_seconds,completed\nZIP-1,7,hard,2,181,true',
  );
});
