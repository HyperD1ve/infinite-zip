import { areAdjacent, buildWallSet, cellKey, hasWallBetween } from '../game/board.js';
import { generatePuzzle } from '../generator/puzzle.js';
import { createFeedbackRecord, saveFeedbackRecord } from './feedback.js';
import { arrowDestination, isArrowKey } from './input.js';
import { renderBoard } from './components/boardView.js';

const DEFAULT_ROWS = 5;
const DEFAULT_COLS = 5;
const DEFAULT_TARGET = 'hard';

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
const board = document.querySelector('#board');
const stats = document.querySelector('#stats');
const status = document.querySelector('#status');

const state = {
  /** @type {import('../types/index.js').Puzzle | null} */
  puzzle: null,
  /** @type {import('../types/index.js').SolutionPath} */
  playerPath: [],
  reveal: false,
  evaluationStartedAt: Date.now(),
  hintCount: 0,
  completed: false,
  saved: false,
  busy: false,
};

hintButton.addEventListener('click', () => handleHint());
submitNextButton.addEventListener('click', () => submitFeedbackAndAdvance());
enjoymentScoreInput.addEventListener('input', () => {
  enjoymentValue.textContent = enjoymentScoreInput.value;
});
document.addEventListener('keydown', handleKeyDown);
setInterval(() => renderLoopState(), 1000);

generateNextPuzzle();

function generateNextPuzzle() {
  setBusy(true, 'Loading');
  setStatus('Generating');

  requestAnimationFrame(() => {
    try {
      state.puzzle = generatePuzzle({
        rows: DEFAULT_ROWS,
        cols: DEFAULT_COLS,
        target: DEFAULT_TARGET,
        seed: randomUiSeed(),
      });
      resetPlayState();
      setStatus('Ready');
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
  if (!state.puzzle || isTypingTarget(event.target)) {
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
  if (!state.puzzle || state.reveal) {
    return;
  }

  const path = state.playerPath;
  const key = cellKey(cell);
  const seenIndex = path.findIndex((pathCell) => cellKey(pathCell) === key);

  if (seenIndex >= 0) {
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
    return;
  }

  renderLoopState();
  hintButton.disabled = state.reveal || state.busy;
  candidateTitle.textContent = 'Puzzle';
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

async function submitFeedbackAndAdvance() {
  if (!state.puzzle?.seed) {
    setStatus('No puzzle');
    return false;
  }

  setBusy(true, 'Saving');
  setStatus('Saving');
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - state.evaluationStartedAt) / 1000));
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
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - state.evaluationStartedAt) / 1000));
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
 * @param {boolean} busy
 * @param {string} label
 */
function setBusy(busy, label = 'Working') {
  state.busy = busy;
  submitNextButton.disabled = busy;
  hintButton.disabled = busy || state.reveal;
  submitNextButton.textContent = busy ? label : 'Save & Next';
}

/**
 * @param {string} message
 */
function setStatus(message) {
  status.textContent = message;
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
