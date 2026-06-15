import { cellKey } from '../../game/board.js';

/**
 * @param {{
 *   container: HTMLElement,
 *   puzzle: import('../../types/index.js').Puzzle,
 *   playerPath: import('../../types/index.js').SolutionPath,
 *   reveal: boolean,
 *   onPick: (cell: import('../../types/index.js').Cell) => void
 * }} props
 */
export function renderBoard(props) {
  const { container, puzzle, playerPath, reveal, onPick } = props;
  const activePath = reveal && puzzle.solution ? puzzle.solution : playerPath;
  const clueByCell = new Map(puzzle.clues.map((clue) => [cellKey(clue), clue]));
  const pathIndex = new Map(activePath.map((cell, index) => [cellKey(cell), index]));
  const playerIndex = new Map(playerPath.map((cell, index) => [cellKey(cell), index]));
  const connections = buildConnections(activePath);
  const wallDirections = buildWallDirections(puzzle.walls ?? []);

  container.style.setProperty('--rows', String(puzzle.rows));
  container.style.setProperty('--cols', String(puzzle.cols));
  container.replaceChildren();

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      const cell = { row, col };
      const key = cellKey(cell);
      const clue = clueByCell.get(key);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      button.dataset.row = String(row);
      button.dataset.col = String(col);
      button.setAttribute('aria-label', clue ? `Clue ${clue.number}` : `Row ${row + 1}, column ${col + 1}`);

      if (clue) {
        button.classList.add('is-clue');
      }
      if (pathIndex.has(key)) {
        button.classList.add('is-path');
      }
      if (playerIndex.get(key) === playerPath.length - 1 && !reveal) {
        button.classList.add('is-current');
      }
      if (reveal) {
        button.classList.add('is-revealed');
      }

      for (const direction of ['up', 'right', 'down', 'left']) {
        const rail = document.createElement('span');
        rail.className = `rail rail-${direction}`;
        if (connections.get(key)?.has(direction)) {
          rail.classList.add('is-on');
        }
        button.append(rail);
      }

      for (const direction of wallDirections.get(key) ?? []) {
        const wall = document.createElement('span');
        wall.className = `wall wall-${direction}`;
        button.append(wall);
      }

      if (clue) {
        const badge = document.createElement('span');
        badge.className = 'clue-badge';
        badge.textContent = String(clue.number);
        button.append(badge);
      } else if (playerIndex.has(key) && !reveal) {
        const ghost = document.createElement('span');
        ghost.className = 'path-count';
        ghost.textContent = String(playerIndex.get(key) + 1);
        button.append(ghost);
      }

      button.addEventListener('click', () => onPick(cell));
      container.append(button);
    }
  }
}

/**
 * @param {import('../../types/index.js').SolutionPath} path
 */
function buildConnections(path) {
  const connections = new Map();

  /**
   * @param {import('../../types/index.js').Cell} cell
   * @param {string} direction
   */
  function add(cell, direction) {
    const key = cellKey(cell);
    if (!connections.has(key)) {
      connections.set(key, new Set());
    }
    connections.get(key).add(direction);
  }

  for (let index = 1; index < path.length; index += 1) {
    const prev = path[index - 1];
    const next = path[index];

    if (next.row < prev.row) {
      add(prev, 'up');
      add(next, 'down');
    } else if (next.row > prev.row) {
      add(prev, 'down');
      add(next, 'up');
    } else if (next.col < prev.col) {
      add(prev, 'left');
      add(next, 'right');
    } else if (next.col > prev.col) {
      add(prev, 'right');
      add(next, 'left');
    }
  }

  return connections;
}

/**
 * @param {import('../../types/index.js').Wall[]} walls
 */
function buildWallDirections(walls) {
  const directions = new Map();

  /**
   * @param {import('../../types/index.js').Cell} cell
   * @param {string} direction
   */
  function add(cell, direction) {
    const key = cellKey(cell);
    if (!directions.has(key)) {
      directions.set(key, new Set());
    }
    directions.get(key).add(direction);
  }

  for (const wall of walls) {
    const { a, b } = wall;
    if (b.row < a.row) {
      add(a, 'up');
      add(b, 'down');
    } else if (b.row > a.row) {
      add(a, 'down');
      add(b, 'up');
    } else if (b.col < a.col) {
      add(a, 'left');
      add(b, 'right');
    } else if (b.col > a.col) {
      add(a, 'right');
      add(b, 'left');
    }
  }

  return directions;
}
