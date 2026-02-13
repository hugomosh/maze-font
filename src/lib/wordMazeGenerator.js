// wordMazeGenerator.js
// Generates a word maze where the solution path visits each letter in order.
// Each letter is a sealed "closed box" with a single entry/exit point.
// The solver must trace the letter's contour to get from entry to exit.

import { recursiveBacktracker } from './mazeGenerator';

// --- Constants (mirrored from SvgGrid.jsx) ---
const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 12;
const CHAR_PADDING_UNITS = 1;
const CHAR_CELL_WIDTH_UNITS = CHAR_CONTENT_WIDTH + CHAR_PADDING_UNITS * 2;
const CHAR_CELL_HEIGHT_UNITS = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2;

// --- Helpers ---
function hasWall(fixedWalls, x, y, dir) {
  const fixed = fixedWalls.get(`${x},${y}`);
  return !!(fixed && fixed[dir]);
}

function setFixed(fixedWalls, x, y, dir, gridWidth, gridHeight) {
  if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return;
  const key = `${x},${y}`;
  if (!fixedWalls.has(key)) {
    fixedWalls.set(key, { top: false, right: false, bottom: false, left: false });
  }
  fixedWalls.get(key)[dir] = true;
}

function isConnected(fixedWalls, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 1) return !hasWall(fixedWalls, x1, y1, 'right') && !hasWall(fixedWalls, x2, y2, 'left');
  if (dx === -1) return !hasWall(fixedWalls, x1, y1, 'left') && !hasWall(fixedWalls, x2, y2, 'right');
  if (dy === 1) return !hasWall(fixedWalls, x1, y1, 'bottom') && !hasWall(fixedWalls, x2, y2, 'top');
  if (dy === -1) return !hasWall(fixedWalls, x1, y1, 'top') && !hasWall(fixedWalls, x2, y2, 'bottom');
  return false;
}

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const DIR_DX = { top: 0, bottom: 0, left: -1, right: 1 };
const DIR_DY = { top: -1, bottom: 1, left: 0, right: 0 };

// --- Phase 1: Layout characters ---
function layoutCharacters(text, gridWidthUnits, gridHeightUnits) {
  const charsPerGridRow = Math.floor(gridWidthUnits / CHAR_CELL_WIDTH_UNITS);
  return text.split('').map((char, index) => {
    const charCol = index % charsPerGridRow;
    const charRow = Math.floor(index / charsPerGridRow);
    const x = charCol * CHAR_CELL_WIDTH_UNITS;
    const y = charRow * CHAR_CELL_HEIGHT_UNITS;
    if ((x + CHAR_CELL_WIDTH_UNITS) > gridWidthUnits || (y + CHAR_CELL_HEIGHT_UNITS) > gridHeightUnits) {
      return null;
    }
    return { char, x, y, index };
  }).filter(Boolean);
}

// --- Phase 1b: Build fixed walls from font data ---
function fontWallsToFixedWalls(characters, gridWidth, gridHeight, fontData) {
  const fixedWalls = new Map();
  for (const { char, x: charX, y: charY } of characters) {
    const charData = fontData[char.toUpperCase()];
    if (!charData) continue;
    for (const [x1, y1, x2, y2] of charData) {
      const gx1 = charX + x1;
      const gy1 = charY + y1;
      const gx2 = charX + x2;
      const gy2 = charY + y2;
      if (gx1 === gx2) {
        const gx = gx1;
        const minY = Math.min(gy1, gy2);
        const maxY = Math.max(gy1, gy2);
        for (let gy = minY; gy < maxY; gy++) {
          setFixed(fixedWalls, gx - 1, gy, 'right', gridWidth, gridHeight);
          setFixed(fixedWalls, gx, gy, 'left', gridWidth, gridHeight);
        }
      } else if (gy1 === gy2) {
        const gy = gy1;
        const minX = Math.min(gx1, gx2);
        const maxX = Math.max(gx1, gx2);
        for (let gx = minX; gx < maxX; gx++) {
          setFixed(fixedWalls, gx, gy - 1, 'bottom', gridWidth, gridHeight);
          setFixed(fixedWalls, gx, gy, 'top', gridWidth, gridHeight);
        }
      }
    }
  }
  return fixedWalls;
}

// --- Phase 2: Detect stroke cells for a character ---
function detectStrokesForChar(charX, charY, fixedWalls, gridW, gridH) {
  // Content area for this character
  const contentAreaCells = new Set();
  for (let dy = 1; dy < CHAR_CELL_HEIGHT_UNITS - 1; dy++) {
    for (let dx = 1; dx < CHAR_CELL_WIDTH_UNITS - 1; dx++) {
      contentAreaCells.add(`${charX + dx},${charY + dy}`);
    }
  }

  const getWallCount = (x, y) => {
    return (hasWall(fixedWalls, x, y, 'top') ? 1 : 0) +
      (hasWall(fixedWalls, x, y, 'right') ? 1 : 0) +
      (hasWall(fixedWalls, x, y, 'bottom') ? 1 : 0) +
      (hasWall(fixedWalls, x, y, 'left') ? 1 : 0);
  };

  const enclosedCorridors = new Set();
  const strokeQueue = [];

  // Step 1: Seed high-confidence strokes (3+ walls or 2 opposite walls)
  for (let dy = 1; dy < CHAR_CELL_HEIGHT_UNITS - 1; dy++) {
    for (let dx = 1; dx < CHAR_CELL_WIDTH_UNITS - 1; dx++) {
      const x = charX + dx;
      const y = charY + dy;
      const key = `${x},${y}`;
      const wallCount = getWallCount(x, y);

      if (wallCount >= 3) {
        enclosedCorridors.add(key);
        strokeQueue.push({ x, y });
        continue;
      }

      if (wallCount === 2) {
        const hasLeft = hasWall(fixedWalls, x, y, 'left');
        const hasRight = hasWall(fixedWalls, x, y, 'right');
        const hasTop = hasWall(fixedWalls, x, y, 'top');
        const hasBottom = hasWall(fixedWalls, x, y, 'bottom');
        if ((hasLeft && hasRight) || (hasTop && hasBottom)) {
          enclosedCorridors.add(key);
          strokeQueue.push({ x, y });
        }
      }
    }
  }

  // Step 2: Flood propagate to connected corridors/intersections
  while (strokeQueue.length > 0) {
    const { x, y } = strokeQueue.shift();
    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of neighbors) {
      const nKey = `${nx},${ny}`;
      if (!contentAreaCells.has(nKey)) continue;
      if (enclosedCorridors.has(nKey)) continue;
      const nWallCount = getWallCount(nx, ny);
      if (nWallCount >= 3 && isConnected(fixedWalls, x, y, nx, ny)) {
        enclosedCorridors.add(nKey);
        strokeQueue.push({ x: nx, y: ny });
      } else if (nWallCount === 2) {
        const hasLeft = hasWall(fixedWalls, nx, ny, 'left');
        const hasRight = hasWall(fixedWalls, nx, ny, 'right');
        const hasTop = hasWall(fixedWalls, nx, ny, 'top');
        const hasBottom = hasWall(fixedWalls, nx, ny, 'bottom');
        if (((hasLeft && hasRight) || (hasTop && hasBottom)) && isConnected(fixedWalls, x, y, nx, ny)) {
          enclosedCorridors.add(nKey);
          strokeQueue.push({ x: nx, y: ny });
        }
      }
    }
  }

  // Step 3: Corner propagation (2 adjacent walls connected to strokes)
  let changed = true;
  while (changed) {
    changed = false;
    for (let dy = 1; dy < CHAR_CELL_HEIGHT_UNITS - 1; dy++) {
      for (let dx = 1; dx < CHAR_CELL_WIDTH_UNITS - 1; dx++) {
        const x = charX + dx;
        const y = charY + dy;
        const key = `${x},${y}`;
        if (enclosedCorridors.has(key)) continue;
        if (!contentAreaCells.has(key)) continue;

        const wallCount = getWallCount(x, y);
        if (wallCount !== 2) continue;

        const hasLeft = hasWall(fixedWalls, x, y, 'left');
        const hasRight = hasWall(fixedWalls, x, y, 'right');
        const hasTop = hasWall(fixedWalls, x, y, 'top');
        const hasBottom = hasWall(fixedWalls, x, y, 'bottom');
        if ((hasLeft && hasRight) || (hasTop && hasBottom)) continue;

        const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
        for (const [nx, ny] of neighbors) {
          if (enclosedCorridors.has(`${nx},${ny}`) && isConnected(fixedWalls, x, y, nx, ny)) {
            enclosedCorridors.add(key);
            changed = true;
            break;
          }
        }
      }
    }
  }

  return enclosedCorridors;
}

// --- Phase 3: Find boundary stroke cells ---
// A "boundary" stroke cell has at least one font wall facing a non-stroke cell.
// Returns all boundary cells with their opening direction and outside cell.
function findBoundaryCells(strokeCells, fixedWalls, gridW, gridH) {
  const boundary = [];
  const dirs = ['top', 'right', 'bottom', 'left'];

  for (const key of strokeCells) {
    const [x, y] = key.split(',').map(Number);
    for (const dir of dirs) {
      // Must have a font wall on this side
      if (!hasWall(fixedWalls, x, y, dir)) continue;

      const ox = x + DIR_DX[dir];
      const oy = y + DIR_DY[dir];

      // Outside cell must exist and be non-stroke
      if (ox < 0 || ox >= gridW || oy < 0 || oy >= gridH) continue;
      if (strokeCells.has(`${ox},${oy}`)) continue;

      // The outside cell must also have the matching wall (both sides of font line)
      if (!hasWall(fixedWalls, ox, oy, OPPOSITE[dir])) continue;

      boundary.push({ x, y, dir, ox, oy });
    }
  }
  return boundary;
}

// Pick entry and exit: choose two boundary cells that are far apart (max manhattan distance).
function pickEntryExit(boundary) {
  if (boundary.length < 2) return null;

  let bestDist = -1;
  let bestPair = null;

  for (let i = 0; i < boundary.length; i++) {
    for (let j = i + 1; j < boundary.length; j++) {
      const a = boundary[i];
      const b = boundary[j];
      const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (dist > bestDist) {
        bestDist = dist;
        bestPair = { entry: a, exit: b };
      }
    }
  }
  return bestPair;
}

// --- Phase 3b: Apply entry/exit modifications to fixedWalls ---
// Opens the font wall at entry and exit so the solver can enter/leave the letter.
function applyEntryExit(fixedWalls, pair) {
  const { entry, exit } = pair;

  // Remove entry's font wall (stroke cell side + outside cell side)
  if (fixedWalls.has(`${entry.x},${entry.y}`)) {
    fixedWalls.get(`${entry.x},${entry.y}`)[entry.dir] = false;
  }
  if (fixedWalls.has(`${entry.ox},${entry.oy}`)) {
    fixedWalls.get(`${entry.ox},${entry.oy}`)[OPPOSITE[entry.dir]] = false;
  }

  // Remove exit's font wall (stroke cell side + outside cell side)
  if (fixedWalls.has(`${exit.x},${exit.y}`)) {
    fixedWalls.get(`${exit.x},${exit.y}`)[exit.dir] = false;
  }
  if (fixedWalls.has(`${exit.ox},${exit.oy}`)) {
    fixedWalls.get(`${exit.ox},${exit.oy}`)[OPPOSITE[exit.dir]] = false;
  }
}

// --- Phase 4: Carve letter interior (restricted recursive backtracker) ---
function carveLetterInterior(grid, fixedWalls, strokeCells, entryCell) {
  // Run DFS through only stroke cells, respecting fixed walls (center walls).
  // This creates a spanning tree of the letter's corridor system.
  const visited = new Set();
  const stack = [entryCell];
  visited.add(`${entryCell.x},${entryCell.y}`);

  const cell = grid[entryCell.y][entryCell.x];
  cell.visited = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const { x, y } = current;
    const dirs = ['top', 'right', 'bottom', 'left'];

    // Shuffle directions for randomness
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    let found = false;
    for (const dir of dirs) {
      const nx = x + DIR_DX[dir];
      const ny = y + DIR_DY[dir];
      const nKey = `${nx},${ny}`;

      // Must be a stroke cell
      if (!strokeCells.has(nKey)) continue;
      // Must not be visited
      if (visited.has(nKey)) continue;
      // Must not have a fixed wall blocking
      if (hasWall(fixedWalls, x, y, dir)) continue;
      if (hasWall(fixedWalls, nx, ny, OPPOSITE[dir])) continue;

      // Carve: remove walls between current and neighbor
      const currentCell = grid[y][x];
      const neighborCell = grid[ny][nx];
      currentCell.walls[dir] = false;
      neighborCell.walls[OPPOSITE[dir]] = false;
      neighborCell.visited = true;
      visited.add(nKey);
      stack.push({ x: nx, y: ny });
      found = true;
      break;
    }

    if (!found) {
      stack.pop();
    }
  }

  return visited;
}

// --- Phase 5: Carve external path between letters (BFS) ---
function carveExternalPath(grid, fixedWalls, fromCell, toCell, gridW, gridH, visitedCells, allStrokeCells) {
  // BFS from fromCell to toCell through unvisited non-stroke cells
  const queue = [{ x: fromCell.x, y: fromCell.y, path: [{ x: fromCell.x, y: fromCell.y }] }];
  const seen = new Set();
  seen.add(`${fromCell.x},${fromCell.y}`);

  while (queue.length > 0) {
    const { x, y, path } = queue.shift();

    if (x === toCell.x && y === toCell.y) {
      // Found path - carve it
      for (let i = 0; i < path.length - 1; i++) {
        const curr = path[i];
        const next = path[i + 1];
        const dx = next.x - curr.x;
        const dy = next.y - curr.y;

        let dir;
        if (dx === 1) dir = 'right';
        else if (dx === -1) dir = 'left';
        else if (dy === 1) dir = 'bottom';
        else dir = 'top';

        grid[curr.y][curr.x].walls[dir] = false;
        grid[next.y][next.x].walls[OPPOSITE[dir]] = false;
        grid[curr.y][curr.x].visited = true;
        grid[next.y][next.x].visited = true;
        visitedCells.add(`${curr.x},${curr.y}`);
        visitedCells.add(`${next.x},${next.y}`);
      }
      return path;
    }

    const dirs = ['top', 'right', 'bottom', 'left'];
    for (const dir of dirs) {
      const nx = x + DIR_DX[dir];
      const ny = y + DIR_DY[dir];
      const nKey = `${nx},${ny}`;

      if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
      if (seen.has(nKey)) continue;
      // Allow the target cell even if visited
      if (nKey !== `${toCell.x},${toCell.y}`) {
        if (visitedCells.has(nKey)) continue;
        if (allStrokeCells.has(nKey)) continue;
      }
      // Check no fixed wall blocks movement
      if (hasWall(fixedWalls, x, y, dir)) continue;
      if (hasWall(fixedWalls, nx, ny, OPPOSITE[dir])) continue;

      seen.add(nKey);
      queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
    }
  }

  return null; // No path found
}

// --- Phase 6: Fill remaining space with maze ---
function fillRemainingSpace(grid, fixedWalls, gridW, gridH) {
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!grid[y][x].visited) {
        recursiveBacktracker(grid, grid[y][x], fixedWalls);
      }
    }
  }
}

// --- Main entry point ---
export function generateWordMaze(text, gridWidth, gridHeight, fontData) {
  if (!text || gridWidth <= 0 || gridHeight <= 0) {
    return { walls: [], solutionPath: [], characters: [], startCell: null, endCell: null };
  }

  // Phase 1: Layout characters
  const characters = layoutCharacters(text, gridWidth, gridHeight);
  if (characters.length === 0) {
    return { walls: [], solutionPath: [], characters: [], startCell: null, endCell: null };
  }

  // Phase 1b: Build fixed walls from font data
  const fixedWalls = fontWallsToFixedWalls(characters, gridWidth, gridHeight, fontData);

  // Phase 2: Detect stroke cells for each character
  const charStrokeCells = [];
  const allStrokeCells = new Set();
  for (const charInfo of characters) {
    const strokes = detectStrokesForChar(charInfo.x, charInfo.y, fixedWalls, gridWidth, gridHeight);
    charStrokeCells.push(strokes);
    for (const key of strokes) {
      allStrokeCells.add(key);
    }
  }

  // Phase 3: Find entry/exit pairs for each letter
  const entryExitPairs = [];
  for (let i = 0; i < characters.length; i++) {
    const boundary = findBoundaryCells(charStrokeCells[i], fixedWalls, gridWidth, gridHeight);
    const pair = pickEntryExit(boundary);
    if (!pair) {
      // Fallback: if no valid pair, skip this letter
      entryExitPairs.push(null);
      continue;
    }
    // Apply modifications to fixedWalls (open entry/exit walls)
    applyEntryExit(fixedWalls, pair);
    entryExitPairs.push(pair);
  }

  // Build the grid
  const grid = Array.from({ length: gridHeight }, (_, y) =>
    Array.from({ length: gridWidth }, (_, x) => ({
      x, y, visited: false,
      walls: { top: true, right: true, bottom: true, left: true },
    }))
  );

  // Mark all stroke cells as visited in the grid (so maze filler skips them)
  // But DON'T remove walls yet - the letter interior carver will do that
  for (const key of allStrokeCells) {
    const [x, y] = key.split(',').map(Number);
    grid[y][x].visited = true;
  }

  const visitedCells = new Set(allStrokeCells);
  const solutionPath = [];

  // Phase 4: Carve letter interiors
  for (let i = 0; i < characters.length; i++) {
    if (!entryExitPairs[i]) continue;
    const pair = entryExitPairs[i];

    // Reset visited state for stroke cells of this character so DFS can traverse them
    for (const key of charStrokeCells[i]) {
      const [x, y] = key.split(',').map(Number);
      grid[y][x].visited = false;
    }

    // Carve the letter interior starting from the entry cell
    const letterVisited = carveLetterInterior(grid, fixedWalls, charStrokeCells[i], pair.entry);

    // Re-mark all stroke cells as visited
    for (const key of charStrokeCells[i]) {
      const [x, y] = key.split(',').map(Number);
      grid[y][x].visited = true;
    }
  }

  // Phase 4b: Open passages between entry/exit stroke cells and their outside cells
  for (let i = 0; i < characters.length; i++) {
    if (!entryExitPairs[i]) continue;
    const { entry, exit } = entryExitPairs[i];

    // Open entry stroke cell -> outside cell
    grid[entry.y][entry.x].walls[entry.dir] = false;
    grid[entry.oy][entry.ox].walls[OPPOSITE[entry.dir]] = false;

    // Open exit stroke cell -> outside cell
    grid[exit.y][exit.x].walls[exit.dir] = false;
    grid[exit.oy][exit.ox].walls[OPPOSITE[exit.dir]] = false;
  }

  // Phase 5: Carve external paths between consecutive letters
  for (let i = 0; i < characters.length - 1; i++) {
    if (!entryExitPairs[i] || !entryExitPairs[i + 1]) continue;

    const exitPair = entryExitPairs[i].exit;
    const entryPair = entryExitPairs[i + 1].entry;
    const fromCell = { x: exitPair.ox, y: exitPair.oy };
    const toCell = { x: entryPair.ox, y: entryPair.oy };

    const path = carveExternalPath(grid, fixedWalls, fromCell, toCell, gridWidth, gridHeight, visitedCells, allStrokeCells);
    if (path) {
      solutionPath.push(...path);
    }
  }

  // Phase 6: Fill remaining space with maze
  fillRemainingSpace(grid, fixedWalls, gridWidth, gridHeight);

  // Phase 7: Define start and end
  const firstPair = entryExitPairs[0];
  const lastPair = entryExitPairs[characters.length - 1];
  const startCell = firstPair ? { x: firstPair.entry.ox, y: firstPair.entry.oy } : null;
  const endCell = lastPair ? { x: lastPair.exit.ox, y: lastPair.exit.oy } : null;

  // Convert grid to wall segments
  const walls = [];
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = grid[y][x];
      if (cell.walls.top) walls.push([x, y, x + 1, y]);
      if (cell.walls.right) walls.push([x + 1, y, x + 1, y + 1]);
      if (cell.walls.bottom) walls.push([x, y + 1, x + 1, y + 1]);
      if (cell.walls.left) walls.push([x, y, x, y + 1]);
    }
  }

  return {
    walls,
    solutionPath,
    characters,
    startCell,
    endCell,
    entryExitPairs,
    strokeCells: allStrokeCells,
  };
}
