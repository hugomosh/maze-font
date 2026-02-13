// wordMaze.test.js
// Visual step-by-step test for the word maze algorithm with a single letter.

import { describe, it, expect } from 'vitest';
import fontData from '../assets/maze-font.json';

// --- Seeded PRNG (mulberry32) ---
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Constants ---
const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 12;
const CHAR_PADDING_UNITS = 1;
const CHAR_CELL_WIDTH_UNITS = CHAR_CONTENT_WIDTH + CHAR_PADDING_UNITS * 2;  // 10
const CHAR_CELL_HEIGHT_UNITS = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2; // 14

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const DIR_DX = { top: 0, bottom: 0, left: -1, right: 1 };
const DIR_DY = { top: -1, bottom: 1, left: 0, right: 0 };

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

// --- Phase 1b: Build fixed walls from font data ---
function fontWallsToFixedWalls(characters, gridWidth, gridHeight) {
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

// --- Phase 2: Detect stroke cells ---
function detectStrokesForChar(charX, charY, fixedWalls) {
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
        const hL = hasWall(fixedWalls, x, y, 'left');
        const hR = hasWall(fixedWalls, x, y, 'right');
        const hT = hasWall(fixedWalls, x, y, 'top');
        const hB = hasWall(fixedWalls, x, y, 'bottom');
        if ((hL && hR) || (hT && hB)) {
          enclosedCorridors.add(key);
          strokeQueue.push({ x, y });
        }
      }
    }
  }

  while (strokeQueue.length > 0) {
    const { x, y } = strokeQueue.shift();
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const nKey = `${nx},${ny}`;
      if (!contentAreaCells.has(nKey) || enclosedCorridors.has(nKey)) continue;
      const nWC = getWallCount(nx, ny);
      if (nWC >= 3 && isConnected(fixedWalls, x, y, nx, ny)) {
        enclosedCorridors.add(nKey);
        strokeQueue.push({ x: nx, y: ny });
      } else if (nWC === 2) {
        const hL = hasWall(fixedWalls, nx, ny, 'left');
        const hR = hasWall(fixedWalls, nx, ny, 'right');
        const hT = hasWall(fixedWalls, nx, ny, 'top');
        const hB = hasWall(fixedWalls, nx, ny, 'bottom');
        if (((hL && hR) || (hT && hB)) && isConnected(fixedWalls, x, y, nx, ny)) {
          enclosedCorridors.add(nKey);
          strokeQueue.push({ x: nx, y: ny });
        }
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let dy = 1; dy < CHAR_CELL_HEIGHT_UNITS - 1; dy++) {
      for (let dx = 1; dx < CHAR_CELL_WIDTH_UNITS - 1; dx++) {
        const x = charX + dx;
        const y = charY + dy;
        const key = `${x},${y}`;
        if (enclosedCorridors.has(key) || !contentAreaCells.has(key)) continue;
        const wallCount = getWallCount(x, y);
        if (wallCount !== 2) continue;
        const hL = hasWall(fixedWalls, x, y, 'left');
        const hR = hasWall(fixedWalls, x, y, 'right');
        const hT = hasWall(fixedWalls, x, y, 'top');
        const hB = hasWall(fixedWalls, x, y, 'bottom');
        if ((hL && hR) || (hT && hB)) continue;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
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

// --- Phase 3 (v2): Find boundary stroke cells ---
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

// Pick entry and exit: choose two boundary cells that are far apart.
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

// --- ASCII Grid Visualizer ---
function renderGrid(gridW, gridH, fixedWalls, strokeCells, labels) {
  const lines = [];
  for (let y = 0; y < gridH; y++) {
    let topLine = '';
    for (let x = 0; x < gridW; x++) {
      topLine += '+';
      topLine += hasWall(fixedWalls, x, y, 'top') ? '---' : '   ';
    }
    topLine += '+';
    lines.push(topLine);

    let midLine = '';
    for (let x = 0; x < gridW; x++) {
      midLine += hasWall(fixedWalls, x, y, 'left') ? '|' : ' ';
      const key = `${x},${y}`;
      const label = labels && labels.get(key);
      if (label) {
        midLine += ` ${label} `;
      } else if (strokeCells && strokeCells.has(key)) {
        midLine += ' S ';
      } else {
        midLine += ' . ';
      }
    }
    midLine += hasWall(fixedWalls, gridW - 1, y, 'right') ? '|' : ' ';
    lines.push(midLine);
  }
  let bottomLine = '';
  for (let x = 0; x < gridW; x++) {
    bottomLine += '+';
    bottomLine += hasWall(fixedWalls, x, gridH - 1, 'bottom') ? '---' : '   ';
  }
  bottomLine += '+';
  lines.push(bottomLine);
  return lines.join('\n');
}

function renderMazeGrid(grid, gridW, gridH, labels) {
  const lines = [];
  for (let y = 0; y < gridH; y++) {
    let topLine = '';
    for (let x = 0; x < gridW; x++) {
      topLine += '+';
      topLine += grid[y][x].walls.top ? '---' : '   ';
    }
    topLine += '+';
    lines.push(topLine);

    let midLine = '';
    for (let x = 0; x < gridW; x++) {
      midLine += grid[y][x].walls.left ? '|' : ' ';
      const key = `${x},${y}`;
      const label = labels && labels.get(key);
      if (label) {
        midLine += ` ${label} `;
      } else {
        midLine += '   ';
      }
    }
    midLine += grid[y][gridW - 1].walls.right ? '|' : ' ';
    lines.push(midLine);
  }
  let bottomLine = '';
  for (let x = 0; x < gridW; x++) {
    bottomLine += '+';
    bottomLine += grid[gridH - 1][x].walls.bottom ? '---' : '   ';
  }
  bottomLine += '+';
  lines.push(bottomLine);
  return lines.join('\n');
}


describe('Word Maze - Single Letter "L"', () => {
  const char = 'L';
  const gridW = CHAR_CELL_WIDTH_UNITS;   // 10
  const gridH = CHAR_CELL_HEIGHT_UNITS;  // 14
  const characters = [{ char, x: 0, y: 0 }];

  it('Phase 1+2: font walls and stroke detection', () => {
    const fixedWalls = fontWallsToFixedWalls(characters, gridW, gridH);
    const strokeCells = detectStrokesForChar(0, 0, fixedWalls);

    console.log('\n=== Fixed Walls + Stroke Detection ===');
    console.log(`Grid: ${gridW}x${gridH}, Char: "${char}"`);
    console.log('S = stroke cell, . = empty');
    console.log(renderGrid(gridW, gridH, fixedWalls, strokeCells, null));
    console.log(`Stroke cells: ${strokeCells.size}`);

    expect(strokeCells.size).toBe(36);
  });

  it('Phase 3: find boundary cells and pick entry/exit', () => {
    const fixedWalls = fontWallsToFixedWalls(characters, gridW, gridH);
    const strokeCells = detectStrokesForChar(0, 0, fixedWalls);
    const boundary = findBoundaryCells(strokeCells, fixedWalls, gridW, gridH);

    console.log('\n=== Boundary Cells (stroke cells with font wall facing outside) ===');
    for (const b of boundary) {
      console.log(`  (${b.x},${b.y}) dir=${b.dir} -> outside (${b.ox},${b.oy})`);
    }

    const labels = new Map();
    for (const b of boundary) {
      const key = `${b.x},${b.y}`;
      if (!labels.has(key)) labels.set(key, 'B');
    }
    console.log(renderGrid(gridW, gridH, fixedWalls, strokeCells, labels));

    const pair = pickEntryExit(boundary);
    console.log('\nPicked entry/exit (max manhattan distance):');
    if (pair) {
      console.log(`  Entry: (${pair.entry.x},${pair.entry.y}) dir=${pair.entry.dir} -> outside (${pair.entry.ox},${pair.entry.oy})`);
      console.log(`  Exit:  (${pair.exit.x},${pair.exit.y}) dir=${pair.exit.dir} -> outside (${pair.exit.ox},${pair.exit.oy})`);
    }

    const labels2 = new Map();
    if (pair) {
      labels2.set(`${pair.entry.x},${pair.entry.y}`, 'E');
      labels2.set(`${pair.exit.x},${pair.exit.y}`, 'X');
      labels2.set(`${pair.entry.ox},${pair.entry.oy}`, 'e');
      labels2.set(`${pair.exit.ox},${pair.exit.oy}`, 'x');
    }
    console.log(renderGrid(gridW, gridH, fixedWalls, strokeCells, labels2));

    expect(boundary.length).toBeGreaterThan(1);
    expect(pair).not.toBeNull();
  });

  it('Phase 4: carve letter interior', () => {
    const fixedWalls = fontWallsToFixedWalls(characters, gridW, gridH);
    const strokeCells = detectStrokesForChar(0, 0, fixedWalls);
    const boundary = findBoundaryCells(strokeCells, fixedWalls, gridW, gridH);
    const pair = pickEntryExit(boundary);

    // Open outer walls for entry and exit
    fixedWalls.get(`${pair.entry.x},${pair.entry.y}`)[pair.entry.dir] = false;
    if (fixedWalls.has(`${pair.entry.ox},${pair.entry.oy}`))
      fixedWalls.get(`${pair.entry.ox},${pair.entry.oy}`)[OPPOSITE[pair.entry.dir]] = false;
    fixedWalls.get(`${pair.exit.x},${pair.exit.y}`)[pair.exit.dir] = false;
    if (fixedWalls.has(`${pair.exit.ox},${pair.exit.oy}`))
      fixedWalls.get(`${pair.exit.ox},${pair.exit.oy}`)[OPPOSITE[pair.exit.dir]] = false;

    console.log('\n=== After opening entry/exit walls ===');
    const labels0 = new Map();
    labels0.set(`${pair.entry.x},${pair.entry.y}`, 'E');
    labels0.set(`${pair.exit.x},${pair.exit.y}`, 'X');
    labels0.set(`${pair.entry.ox},${pair.entry.oy}`, 'e');
    labels0.set(`${pair.exit.ox},${pair.exit.oy}`, 'x');
    console.log(renderGrid(gridW, gridH, fixedWalls, strokeCells, labels0));

    // Build grid
    const grid = Array.from({ length: gridH }, (_, y) =>
      Array.from({ length: gridW }, (_, x) => ({
        x, y, visited: false,
        walls: { top: true, right: true, bottom: true, left: true },
      }))
    );

    // Carve with seeded random
    const rng = mulberry32(42);
    const visited = new Set();
    const entryCell = { x: pair.entry.x, y: pair.entry.y };
    const stack = [entryCell];
    visited.add(`${entryCell.x},${entryCell.y}`);
    grid[entryCell.y][entryCell.x].visited = true;

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const { x, y } = current;
      const dirs = ['top', 'right', 'bottom', 'left'];
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
      }

      let found = false;
      for (const dir of dirs) {
        const nx = x + DIR_DX[dir];
        const ny = y + DIR_DY[dir];
        const nKey = `${nx},${ny}`;
        if (!strokeCells.has(nKey)) continue;
        if (visited.has(nKey)) continue;
        if (hasWall(fixedWalls, x, y, dir)) continue;
        if (hasWall(fixedWalls, nx, ny, OPPOSITE[dir])) continue;

        grid[y][x].walls[dir] = false;
        grid[ny][nx].walls[OPPOSITE[dir]] = false;
        grid[ny][nx].visited = true;
        visited.add(nKey);
        stack.push({ x: nx, y: ny });
        found = true;
        break;
      }
      if (!found) stack.pop();
    }

    // Open grid walls at entry/exit
    grid[pair.entry.y][pair.entry.x].walls[pair.entry.dir] = false;
    grid[pair.entry.oy][pair.entry.ox].walls[OPPOSITE[pair.entry.dir]] = false;
    grid[pair.exit.y][pair.exit.x].walls[pair.exit.dir] = false;
    grid[pair.exit.oy][pair.exit.ox].walls[OPPOSITE[pair.exit.dir]] = false;

    console.log('\n=== Letter Interior Carved ===');
    console.log(`Visited ${visited.size} of ${strokeCells.size} stroke cells`);
    const labels = new Map();
    labels.set(`${pair.entry.x},${pair.entry.y}`, 'E');
    labels.set(`${pair.exit.x},${pair.exit.y}`, 'X');
    labels.set(`${pair.entry.ox},${pair.entry.oy}`, 'e');
    labels.set(`${pair.exit.ox},${pair.exit.oy}`, 'x');
    console.log(renderMazeGrid(grid, gridW, gridH, labels));

    const unvisited = [...strokeCells].filter(k => !visited.has(k));
    if (unvisited.length > 0) {
      console.log(`\nUnvisited stroke cells: ${unvisited.join(', ')}`);
    } else {
      console.log('\nAll stroke cells visited!');
    }

    // Find path from entry to exit in the carved tree (BFS)
    const pathQueue = [{ x: pair.entry.x, y: pair.entry.y, path: [`${pair.entry.x},${pair.entry.y}`] }];
    const pathSeen = new Set([`${pair.entry.x},${pair.entry.y}`]);
    let solutionPath = null;

    while (pathQueue.length > 0) {
      const { x, y, path } = pathQueue.shift();
      if (x === pair.exit.x && y === pair.exit.y) {
        solutionPath = path;
        break;
      }
      for (const dir of ['top', 'right', 'bottom', 'left']) {
        if (grid[y][x].walls[dir]) continue;
        const nx = x + DIR_DX[dir];
        const ny = y + DIR_DY[dir];
        const nKey = `${nx},${ny}`;
        if (!strokeCells.has(nKey)) continue;
        if (pathSeen.has(nKey)) continue;
        pathSeen.add(nKey);
        pathQueue.push({ x: nx, y: ny, path: [...path, nKey] });
      }
    }

    if (solutionPath) {
      console.log(`\nSolution path (${solutionPath.length} cells):`);
      const pathLabels = new Map();
      pathLabels.set(solutionPath[0], 'E');
      pathLabels.set(solutionPath[solutionPath.length - 1], 'X');
      for (let i = 1; i < solutionPath.length - 1; i++) {
        pathLabels.set(solutionPath[i], '*');
      }
      pathLabels.set(`${pair.entry.ox},${pair.entry.oy}`, 'e');
      pathLabels.set(`${pair.exit.ox},${pair.exit.oy}`, 'x');
      console.log(renderMazeGrid(grid, gridW, gridH, pathLabels));
    } else {
      console.log('\nNO PATH FOUND from entry to exit!');
    }

    expect(visited.size).toBe(strokeCells.size);
    expect(solutionPath).not.toBeNull();
  });
});
