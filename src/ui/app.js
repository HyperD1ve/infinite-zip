import { areAdjacent, buildWallSet, cellKey, hasWallBetween } from '../game/board.js';
import { generatePuzzle } from '../generator/puzzle.js';
import { createFeedbackRecord, saveFeedbackRecord } from './feedback.js';
import { arrowDestination, isArrowKey } from './input.js';
import { renderBoard } from './components/boardView.js';

const DEFAULT_ROWS = 5;
const DEFAULT_COLS = 5;
const DEFAULT_TARGET = 'hard';

const retrainBatchButton = document.querySelector('#retrain-batch');
const hintButton = document.querySelector('#hint');
const submitNextButton = document.querySelector('#submit-next');
const enjoymentScoreInput = document.querySelector('#enjoyment-score');
const enjoymentValue = document.querySelector('#enjoyment-value');
const difficultyRatingInput = document.querySelector('#difficulty-rating');
const hintCountInput = document.querySelector('#hint-count');
const loopState = document.querySelector('#loop-state');
const elapsedTime = document.querySelector('#elapsed-time');
const completionState = document.querySelector('#completion-state');
const candidateTitle = document.querySelector('#candidate-title');
const sourceState = document.querySelector('#source-state');
const board = document.querySelector('#board');
const stats = document.querySelector('#stats');
const status = document.querySelector('#status');
const pauseOverlay = document.querySelector('#pause-overlay');
const resumeButton = document.querySelector('#resume');

const state = {
  /** @type {import('../types/index.js').Puzzle | null} */
  puzzle: null,
  /** @type {import('../types/index.js').SolutionPath} */
  playerPath: [],
  reveal: false,
  evaluationStartedAt: Date.now(),
  paused: false,
  pausedAt: 0,
  pausedDurationMs: 0,
  hintCount: 0,
  completed: false,
  saved: false,
  busy: false,
  /** @type {{ sourcePath: string, candidates: CandidateRecord[] }} */
  candidateBatch: { sourcePath: '', candidates: [] },
  candidateIndex: 0,
  /** @type {CandidateRecord | null} */
  currentCandidate: null,
  draggingPath: false,
  dragCellKey: '',
};

resumeButton.addEventListener('click', () => resumeEvaluation());
retrainBatchButton.addEventListener('click', () => retrainAndGenerateBatch());
hintButton.addEventListener('click', () => handleHint());
submitNextButton.addEventListener('click', () => submitFeedbackAndAdvance());
enjoymentScoreInput.addEventListener('input', () => {
  enjoymentValue.textContent = enjoymentScoreInput.value;
});
document.addEventListener('keydown', handleKeyDown);
board.addEventListener('pointerdown', handleBoardPointerDown);
board.addEventListener('pointermove', handleBoardPointerMove);
board.addEventListener('pointerup', handleBoardPointerEnd);
board.addEventListener('pointercancel', handleBoardPointerEnd);
setInterval(() => renderLoopState(), 1000);

initialize();

async function initialize() {
  await loadCandidateBatch();
  generateNextPuzzle();
}

async function loadCandidateBatch() {
  try {
    const response = await fetch('/api/candidates');
    const result = await response.json();
    if (!response.ok || !result.ok || !Array.isArray(result.candidates)) {
      throw new Error(result.error ?? 'Candidate load failed');
    }

    state.candidateBatch = {
      sourcePath: result.sourcePath ?? '',
      candidates: result.candidates,
    };
    state.candidateIndex = 0;
  } catch (error) {
    console.warn(error);
    state.candidateBatch = { sourcePath: '', candidates: [] };
    state.candidateIndex = 0;
  }
}

function generateNextPuzzle() {
  setBusy(true, 'Loading');
  setStatus('Generating');

  requestAnimationFrame(() => {
    try {
      const candidate = nextCandidate();
      if (candidate?.puzzle) {
        state.currentCandidate = candidate;
        state.puzzle = {
          ...candidate.puzzle,
          seed: candidate.puzzle.seed ?? candidate.featureRow?.id ?? `CANDIDATE-${state.candidateIndex}`,
        };
      } else if (hasCompletedCandidateBatch()) {
        state.currentCandidate = null;
        state.puzzle = null;
        state.playerPath = [];
        state.reveal = false;
        state.completed = false;
        state.saved = false;
        setStatus('Batch complete. Retrain for more candidates.');
        renderEmptyState();
        return;
      } else {
        state.currentCandidate = null;
        state.puzzle = generatePuzzle({
          rows: DEFAULT_ROWS,
          cols: DEFAULT_COLS,
          target: DEFAULT_TARGET,
          seed: randomUiSeed(),
        });
      }
      resetPlayState();
      setStatus(state.currentCandidate ? 'Batch candidate' : 'Fresh generated');
      render();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  });
}

function handleHint() {
  if (!state.puzzle || state.reveal) {
    return;
  }

  state.hintCount += 1;
  state.reveal = true;
  syncEvaluationFields();
  setStatus('Hint shown');
  render();
}

/**
 * @param {KeyboardEvent} event
 */
function handleKeyDown(event) {
  if (state.paused) {
    event.preventDefault();
    resumeEvaluation();
    return;
  }

  if (!state.puzzle || isTypingTarget(event.target)) {
    return;
  }

  if (event.code === 'Escape') {
    event.preventDefault();
    pauseEvaluation();
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    resetPlayState();
    setStatus('Reset');
    render();
    return;
  }

  if (state.reveal) {
    return;
  }

  if (!isArrowKey(event.key)) {
    return;
  }

  const current = state.playerPath[state.playerPath.length - 1] ?? startCell();
  const next = arrowDestination(state.puzzle.rows, state.puzzle.cols, current, event.key);
  event.preventDefault();

  if (!next) {
    setStatus('Edge');
    return;
  }

  pickCell(next);
}

/**
 * @param {import('../types/index.js').Cell} cell
 */
function pickCell(cell) {
  if (!state.puzzle || state.reveal || state.paused) {
    return;
  }

  const path = state.playerPath;
  const key = cellKey(cell);
  const seenIndex = path.findIndex((pathCell) => cellKey(pathCell) === key);

  if (seenIndex >= 0) {
    if (seenIndex === path.length - 2) {
      state.playerPath = path.slice(0, -1);
      state.completed = false;
      setStatus(`${state.playerPath.length}`);
      render();
    }
    return;
  }

  const startClue = state.puzzle.clues[0];
  if (path.length === 0) {
    if (cell.row !== startClue.row || cell.col !== startClue.col) {
      setStatus('Start at 1');
      return;
    }
    state.playerPath = [cell];
    setStatus('Started');
    render();
    return;
  }

  const current = path[path.length - 1];
  if (!areAdjacent(current, cell)) {
    setStatus('Not adjacent');
    return;
  }

  if (hasWallBetween(buildWallSet(state.puzzle.walls ?? []), current, cell)) {
    setStatus('Wall');
    return;
  }

  const clue = clueAt(cell);
  if (clue && clue.number !== nextClueNumber()) {
    setStatus(`Need ${nextClueNumber()}`);
    return;
  }

  const totalCells = state.puzzle.rows * state.puzzle.cols;
  if (clue && clue.number === state.puzzle.clues.length && path.length !== totalCells - 1) {
    setStatus('Finish last');
    return;
  }

  state.playerPath = [...path, cell];
  const solved = state.playerPath.length === totalCells && clue?.number === state.puzzle.clues.length;
  state.completed = solved || state.completed;
  setStatus(solved ? 'Solved' : clue ? `Reached ${clue.number}` : `${state.playerPath.length}`);
  render();
}

function resetPlayState() {
  selectStartClue();
  state.reveal = false;
  state.hintCount = 0;
  state.completed = false;
  state.saved = false;
  state.evaluationStartedAt = Date.now();
  state.paused = false;
  state.pausedAt = 0;
  state.pausedDurationMs = 0;
  renderPauseState();
  resetFeedbackInputs();
  syncEvaluationFields();
}

function selectStartClue() {
  const start = startCell();
  state.playerPath = start ? [start] : [];
}

function startCell() {
  const clue = state.puzzle?.clues[0];
  return clue ? { row: clue.row, col: clue.col } : null;
}

function render() {
  if (!state.puzzle) {
    renderEmptyState();
    return;
  }

  renderLoopState();
  renderPauseState();
  hintButton.disabled = state.reveal || state.busy;
  candidateTitle.textContent = candidateLabel();
  sourceState.textContent = sourceLabel();
  stats.textContent = [
    `${state.puzzle.rows}x${state.puzzle.cols}`,
    `${state.puzzle.clues.length} clues`,
    `${state.puzzle.walls?.length ?? 0} walls`,
  ].join(' / ');

  renderBoard({
    container: board,
    puzzle: state.puzzle,
    playerPath: state.playerPath,
    reveal: state.reveal,
    onPick: pickCell,
  });
}

function renderEmptyState() {
  renderLoopState();
  renderPauseState();
  hintButton.disabled = true;
  submitNextButton.disabled = true;
  candidateTitle.textContent = 'Batch Complete';
  sourceState.textContent = sourceLabel();
  stats.textContent = '';
  board.replaceChildren();
}

async function retrainAndGenerateBatch() {
  setBusy(true, 'Training');
  setStatus('Retraining and generating batch');

  try {
    const response = await fetch('/api/retrain-and-generate', { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.ok || !Array.isArray(result.candidates)) {
      throw new Error(result.error ?? 'Batch generation failed');
    }

    state.candidateBatch = {
      sourcePath: result.sourcePath ?? '',
      candidates: result.candidates,
    };
    state.candidateIndex = 0;
    state.currentCandidate = null;
    setStatus(`Loaded ${result.sourcePath}`);
    generateNextPuzzle();
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : 'Batch generation failed');
    setBusy(false);
    render();
  }
}

async function submitFeedbackAndAdvance() {
  if (!state.puzzle?.seed) {
    setStatus('No puzzle');
    return false;
  }

  setBusy(true, 'Saving');
  setStatus('Saving');
  const elapsedSeconds = currentElapsedSeconds();
  const record = createFeedbackRecord({
    puzzleId: state.puzzle.seed,
    enjoymentScore: Number(enjoymentScoreInput.value),
    difficultyRating: difficultyRatingInput.value,
    hintCount: state.hintCount,
    solveTimeSeconds: elapsedSeconds,
    completed: state.completed,
  });

  saveFeedbackRecord(record);
  let repoSaved = false;

  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        feedback: record,
        featureRow: state.currentCandidate?.featureRow,
        puzzle: state.puzzle,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error ?? 'Save failed');
    }
    state.saved = true;
    repoSaved = true;
    setStatus(`Saved to ${result.statisticsPath}`);
  } catch (error) {
    console.error(error);
    setStatus('Repo save failed; local copy kept');
  } finally {
    setBusy(false);
    renderLoopState();
  }

  if (repoSaved) {
    generateNextPuzzle();
  }

  return repoSaved;
}

function syncEvaluationFields() {
  hintCountInput.value = String(state.hintCount);
}

function resetFeedbackInputs() {
  enjoymentScoreInput.value = '5';
  enjoymentValue.textContent = '5';
  difficultyRatingInput.value = 'hard';
}

function renderLoopState() {
  const elapsedSeconds = currentElapsedSeconds();
  elapsedTime.textContent = `${elapsedSeconds}s`;
  completionState.textContent = state.saved ? 'Saved' : state.completed ? 'Solved' : 'Open';

  if (state.saved) {
    loopState.textContent = 'Saved';
  } else if (state.completed) {
    loopState.textContent = 'Feedback';
  } else if (state.playerPath.length > 1) {
    loopState.textContent = 'Play';
  } else {
    loopState.textContent = 'Evaluate';
  }
}

function pauseEvaluation() {
  if (!state.puzzle || state.paused || state.busy) {
    return;
  }

  state.paused = true;
  state.pausedAt = Date.now();
  state.draggingPath = false;
  setStatus('Paused');
  renderLoopState();
  renderPauseState();
  resumeButton.focus();
}

function resumeEvaluation() {
  if (!state.paused) {
    return;
  }

  state.pausedDurationMs += Date.now() - state.pausedAt;
  state.paused = false;
  state.pausedAt = 0;
  setStatus('Resumed');
  renderLoopState();
  renderPauseState();
}

function renderPauseState() {
  document.body.classList.toggle('is-paused', state.paused);
  pauseOverlay.hidden = !state.paused;
}

function currentElapsedSeconds() {
  const pausedExtra = state.paused ? Date.now() - state.pausedAt : 0;
  return Math.max(0, Math.round((Date.now() - state.evaluationStartedAt - state.pausedDurationMs - pausedExtra) / 1000));
}

function clueAt(cell) {
  return state.puzzle?.clues.find((clue) => clue.row === cell.row && clue.col === cell.col);
}

function nextClueNumber() {
  if (!state.puzzle) {
    return 1;
  }

  let reached = 0;
  const cluesByCell = new Map(state.puzzle.clues.map((clue) => [cellKey(clue), clue.number]));
  for (const cell of state.playerPath) {
    const clueNumber = cluesByCell.get(cellKey(cell));
    if (clueNumber) {
      reached = clueNumber;
    }
  }
  return reached + 1;
}

/**
 * @param {PointerEvent} event
 */
function handleBoardPointerDown(event) {
  if (!state.puzzle || state.reveal || state.paused || event.button > 0) {
    return;
  }

  const cell = cellFromPointer(event);
  if (!cell) {
    return;
  }

  event.preventDefault();
  board.setPointerCapture(event.pointerId);
  state.draggingPath = true;
  state.dragCellKey = '';
  pickCellFromPointer(cell);
}

/**
 * @param {PointerEvent} event
 */
function handleBoardPointerMove(event) {
  if (!state.draggingPath || !state.puzzle || state.reveal || state.paused) {
    return;
  }

  const cell = cellFromPointer(event);
  if (!cell) {
    return;
  }

  event.preventDefault();
  pickCellFromPointer(cell);
}

/**
 * @param {PointerEvent} event
 */
function handleBoardPointerEnd(event) {
  state.draggingPath = false;
  state.dragCellKey = '';
  if (board.hasPointerCapture(event.pointerId)) {
    board.releasePointerCapture(event.pointerId);
  }
}

/**
 * @param {import('../types/index.js').Cell} cell
 */
function pickCellFromPointer(cell) {
  const key = cellKey(cell);
  if (key === state.dragCellKey) {
    return;
  }

  state.dragCellKey = key;
  pickCell(cell);
}

/**
 * @param {PointerEvent} event
 * @returns {import('../types/index.js').Cell | null}
 */
function cellFromPointer(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const cellElement = element instanceof Element ? element.closest('.cell') : null;
  if (!(cellElement instanceof HTMLElement) || !board.contains(cellElement)) {
    return null;
  }

  const row = Number(cellElement.dataset.row);
  const col = Number(cellElement.dataset.col);
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return null;
  }

  return { row, col };
}

/**
 * @param {boolean} busy
 * @param {string} label
 */
function setBusy(busy, label = 'Working') {
  state.busy = busy;
  submitNextButton.disabled = busy || !state.puzzle;
  retrainBatchButton.disabled = busy;
  hintButton.disabled = busy || state.reveal || !state.puzzle;
  submitNextButton.textContent = busy ? label : 'Save & Next';
}

/**
 * @param {string} message
 */
function setStatus(message) {
  status.textContent = message;
}

function nextCandidate() {
  const candidate = state.candidateBatch.candidates[state.candidateIndex] ?? null;
  if (candidate) {
    state.candidateIndex += 1;
  }
  return candidate;
}

function candidateLabel() {
  if (!state.currentCandidate) {
    return 'Generated Puzzle';
  }

  const total = state.candidateBatch.candidates.length;
  const index = Math.max(1, state.candidateIndex);
  return total > 0 ? `Candidate ${index}/${total}` : 'Candidate';
}

function sourceLabel() {
  if (state.currentCandidate) {
    return `Batch: ${basename(state.candidateBatch.sourcePath)}`;
  }

  if (hasCompletedCandidateBatch()) {
    return 'Batch complete';
  }

  return 'Fresh generation';
}

function hasCompletedCandidateBatch() {
  return state.candidateBatch.candidates.length > 0
    && state.candidateIndex >= state.candidateBatch.candidates.length;
}

/**
 * @param {string} filePath
 */
function basename(filePath) {
  return filePath.split('/').filter(Boolean).at(-1) ?? 'candidate batch';
}

function randomUiSeed() {
  return `UI-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * @param {EventTarget | null} target
 */
function isTypingTarget(target) {
  return target instanceof HTMLInputElement
    || target instanceof HTMLSelectElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLElement && target.isContentEditable;
}

/**
 * @typedef {{
 *   rank?: number,
 *   rankingScore?: number,
 *   scorerName?: string,
 *   featureRow?: Record<string, unknown>,
 *   puzzle?: import('../types/index.js').Puzzle
 * }} CandidateRecord
 */
