import { areAdjacent, buildWallSet, cellKey, hasWallBetween } from '../game/board.js';
import { publicPuzzle } from '../game/puzzle.js';
import { generatePuzzle } from '../generator/puzzle.js';
import { arrowDestination, isArrowKey } from './input.js';
import { renderBoard } from './components/boardView.js';

const rowsInput = document.querySelector('#rows');
const colsInput = document.querySelector('#cols');
const targetInput = document.querySelector('#target');
const seedInput = document.querySelector('#seed');
const generateButton = document.querySelector('#generate');
const resetButton = document.querySelector('#reset');
const revealButton = document.querySelector('#reveal');
const copyButton = document.querySelector('#copy');
const board = document.querySelector('#board');
const stats = document.querySelector('#stats');
const status = document.querySelector('#status');

const state = {
  /** @type {import('../types/index.js').Puzzle & { solverStats?: { nodesVisited: number, backtracks: number, branchingEvents: number, branchChoices: number } } | null} */
  puzzle: null,
  /** @type {import('../types/index.js').SolutionPath} */
  playerPath: [],
  reveal: false,
};

generateButton.addEventListener('click', () => generateFromControls());
resetButton.addEventListener('click', () => {
  selectStartClue();
  state.reveal = false;
  setStatus('Reset');
  render();
});
revealButton.addEventListener('click', () => {
  state.reveal = !state.reveal;
  setStatus(state.reveal ? 'Revealed' : 'Hidden');
  render();
});
copyButton.addEventListener('click', () => copyPublicPuzzle());
document.addEventListener('keydown', handleKeyDown);

generateFromControls();

function generateFromControls() {
  setBusy(true);
  setStatus('Generating');

  requestAnimationFrame(() => {
    try {
      const rows = Number(rowsInput.value);
      const cols = Number(colsInput.value);
      const target = targetInput.value;
      const seed = seedInput.value.trim() || randomUiSeed();

      seedInput.value = seed;
      state.puzzle = generatePuzzle({ rows, cols, seed, target });
      selectStartClue();
      state.reveal = false;
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

/**
 * @param {KeyboardEvent} event
 */
function handleKeyDown(event) {
  if (!state.puzzle || state.reveal || !isArrowKey(event.key) || isTypingTarget(event.target)) {
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
    state.playerPath = path.slice(0, seenIndex + 1);
    setStatus('Trimmed');
    render();
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

  const finalClue = state.puzzle.clues[state.puzzle.clues.length - 1];
  const isFinalClue = clue?.number === finalClue.number;
  if (isFinalClue && path.length + 1 !== state.puzzle.rows * state.puzzle.cols) {
    setStatus('Finish last');
    return;
  }

  state.playerPath = [...path, cell];
  const solved = state.playerPath.length === state.puzzle.rows * state.puzzle.cols && isFinalClue;
  setStatus(solved ? 'Solved' : clue ? `Reached ${clue.number}` : `${state.playerPath.length}`);
  render();
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

  revealButton.setAttribute('aria-pressed', String(state.reveal));
  revealButton.classList.toggle('is-active', state.reveal);

  stats.textContent = [
    `${state.puzzle.rows}x${state.puzzle.cols}`,
    `${state.puzzle.clues.length} clues`,
    `${state.puzzle.walls?.length ?? 0} walls`,
    state.puzzle.difficulty,
    `seed ${state.puzzle.seed}`,
  ].filter(Boolean).join(' / ');

  renderBoard({
    container: board,
    puzzle: state.puzzle,
    playerPath: state.playerPath,
    reveal: state.reveal,
    onPick: pickCell,
  });
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

async function copyPublicPuzzle() {
  if (!state.puzzle) {
    return;
  }

  try {
    await navigator.clipboard.writeText(JSON.stringify(publicPuzzle(state.puzzle), null, 2));
    setStatus('Copied');
  } catch (error) {
    console.error(error);
    setStatus('Copy failed');
  }
}

/**
 * @param {boolean} busy
 */
function setBusy(busy) {
  generateButton.disabled = busy;
  generateButton.textContent = busy ? 'Generating' : 'Generate';
}

/**
 * @param {string} message
 */
function setStatus(message) {
  status.textContent = message;
}

function randomUiSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
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
