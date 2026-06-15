export const FEEDBACK_STORAGE_KEY = 'infinite-zip-feedback-v1';

export const FEEDBACK_COLUMNS = [
  'puzzle_id',
  'enjoyment_score',
  'difficulty_rating',
  'hint_count',
  'solve_time_seconds',
  'completed',
];

/**
 * @param {{
 *   puzzleId: string,
 *   enjoymentScore: number,
 *   difficultyRating: string,
 *   hintCount: number,
 *   solveTimeSeconds: number,
 *   completed: boolean
 * }} input
 */
export function createFeedbackRecord(input) {
  return {
    puzzle_id: input.puzzleId,
    enjoyment_score: input.enjoymentScore,
    difficulty_rating: input.difficultyRating,
    hint_count: input.hintCount,
    solve_time_seconds: input.solveTimeSeconds,
    completed: input.completed,
  };
}

export function readFeedbackRecords() {
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * @param {ReturnType<typeof createFeedbackRecord>} record
 */
export function saveFeedbackRecord(record) {
  const existing = readFeedbackRecords();
  const next = [
    ...existing.filter((row) => row.puzzle_id !== record.puzzle_id),
    record,
  ];
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(next));
  return next;
}

/**
 * @param {Record<string, unknown>[]} rows
 */
export function feedbackToCsv(rows) {
  return [
    FEEDBACK_COLUMNS.join(','),
    ...rows.map((row) => FEEDBACK_COLUMNS.map((column) => escapeCsv(row[column])).join(',')),
  ].join('\n');
}

/**
 * @param {unknown} value
 */
function escapeCsv(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
