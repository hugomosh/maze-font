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

// --- Phase 2b: Filter to outer stroke cells only ---
// For letters with interior holes (8, 0, B, etc.), we only want the outer contour.
// "Interior stroke" = adjacent to an interior hole (non-stroke cell NOT reachable from grid edges).
// "Outer stroke" = everything else (including junction cells surrounded by other strokes).
function findOuterStrokeCells(strokeCells, gridW, gridH) {
  // Flood fill from grid edges through non-stroke cells to find "outside"
  const outside = new Set();
  const queue = [];

  for (let x = 0; x < gridW; x++) {
    if (!strokeCells.has(`${x},0`)) queue.push(`${x},0`);
    if (!strokeCells.has(`${x},${gridH - 1}`)) queue.push(`${x},${gridH - 1}`);
  }
  for (let y = 1; y < gridH - 1; y++) {
    if (!strokeCells.has(`0,${y}`)) queue.push(`0,${y}`);
    if (!strokeCells.has(`${gridW - 1},${y}`)) queue.push(`${gridW - 1},${y}`);
  }

  while (queue.length > 0) {
    const key = queue.shift();
    if (outside.has(key)) continue;
    outside.add(key);

    const [x, y] = key.split(',').map(Number);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
      const nKey = `${nx},${ny}`;
      if (!outside.has(nKey) && !strokeCells.has(nKey)) {
        queue.push(nKey);
      }
    }
  }

  // Interior holes: non-stroke cells NOT reachable from grid edges
  const interiorHoles = new Set();
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const key = `${x},${y}`;
      if (!strokeCells.has(key) && !outside.has(key)) {
        interiorHoles.add(key);
      }
    }
  }

  // Outer stroke: NOT adjacent to any interior hole
  const outerStroke = new Set();
  for (const key of strokeCells) {
    const [x, y] = key.split(',').map(Number);
    let adjInterior = false;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (interiorHoles.has(`${nx},${ny}`)) {
        adjInterior = true;
        break;
      }
    }
    if (!adjInterior) outerStroke.add(key);
  }

  return { outerStroke, outside };
}

// --- Phase 3: Find adjacent entry/exit pair ---
// Finds two ADJACENT stroke cells that both face the same outer direction.
// They are separated by a center wall (added if not present), forcing the solver
// to traverse the entire letter corridor to get from entry to exit.
// Gates must open onto the PADDING area (not deep inside content) so the external
// BFS can route between letters through the padding channels.
// Uses rng to randomly select from all valid candidates.
function findAdjacentEntryExitPair(strokeCells, fixedWalls, gridW, gridH, outsideCells, rng, charX, charY) {
  // Content area: the area inside the padding border
  const contentMinX = charX + CHAR_PADDING_UNITS;
  const contentMaxX = charX + CHAR_PADDING_UNITS + CHAR_CONTENT_WIDTH;
  const contentMinY = charY + CHAR_PADDING_UNITS;
  const contentMaxY = charY + CHAR_PADDING_UNITS + CHAR_CONTENT_HEIGHT;
  const isInContent = (cx, cy) => cx >= contentMinX && cx < contentMaxX && cy >= contentMinY && cy < contentMaxY;

  const allCandidates = [];

  for (const outerDir of ['top', 'right', 'bottom', 'left']) {
    const isHorizontalPair = (outerDir === 'top' || outerDir === 'bottom');
    const sepDir = isHorizontalPair ? 'right' : 'bottom';
    const sepDirOpp = OPPOSITE[sepDir];

    for (const key of strokeCells) {
      const [x, y] = key.split(',').map(Number);

      if (!hasWall(fixedWalls, x, y, outerDir)) continue;

      const ox = x + DIR_DX[outerDir];
      const oy = y + DIR_DY[outerDir];
      if (ox < 0 || ox >= gridW || oy < 0 || oy >= gridH) continue;
      if (!outsideCells.has(`${ox},${oy}`)) continue;

      // Outside cell must be in the padding (not inside content area)
      // This ensures the BFS can route through padding channels
      if (isInContent(ox, oy)) continue;

      const nx = x + DIR_DX[sepDir];
      const ny = y + DIR_DY[sepDir];
      if (!strokeCells.has(`${nx},${ny}`)) continue;
      if (!hasWall(fixedWalls, nx, ny, outerDir)) continue;

      const nox = nx + DIR_DX[outerDir];
      const noy = ny + DIR_DY[outerDir];
      if (nox < 0 || nox >= gridW || noy < 0 || noy >= gridH) continue;
      if (!outsideCells.has(`${nox},${noy}`)) continue;
      if (isInContent(nox, noy)) continue;

      allCandidates.push({
        entry: { x, y, dir: outerDir, ox, oy },
        exit: { x: nx, y: ny, dir: outerDir, ox: nox, oy: noy },
        separationDir: sepDir,
        separationDirOpp: sepDirOpp,
      });
    }
  }

  if (allCandidates.length === 0) return null;
  return allCandidates[Math.floor(rng() * allCandidates.length)];
}

// --- Phase 3b: Apply entry/exit modifications to fixedWalls ---
// Opens outer walls, adds center wall between entry/exit, adds blocking wall between outside cells.
function applyEntryExit(fixedWalls, pair, gridW, gridH) {
  const { entry, exit, separationDir, separationDirOpp } = pair;

  // 1. Remove outer walls (open the letter at entry and exit)
  if (fixedWalls.has(`${entry.x},${entry.y}`))
    fixedWalls.get(`${entry.x},${entry.y}`)[entry.dir] = false;
  if (fixedWalls.has(`${entry.ox},${entry.oy}`))
    fixedWalls.get(`${entry.ox},${entry.oy}`)[OPPOSITE[entry.dir]] = false;

  if (fixedWalls.has(`${exit.x},${exit.y}`))
    fixedWalls.get(`${exit.x},${exit.y}`)[exit.dir] = false;
  if (fixedWalls.has(`${exit.ox},${exit.oy}`))
    fixedWalls.get(`${exit.ox},${exit.oy}`)[OPPOSITE[exit.dir]] = false;

  // 2. Add wall between entry and exit (forces path to go around the whole letter)
  setFixed(fixedWalls, entry.x, entry.y, separationDir, gridW, gridH);
  setFixed(fixedWalls, exit.x, exit.y, separationDirOpp, gridW, gridH);

  // 3. Add blocking wall between outside cells (prevents shortcutting)
  setFixed(fixedWalls, entry.ox, entry.oy, separationDir, gridW, gridH);
  setFixed(fixedWalls, exit.ox, exit.oy, separationDirOpp, gridW, gridH);
}

// --- Phase 4: Carve letter interior (restricted recursive backtracker) ---
function carveLetterInterior(grid, fixedWalls, strokeCells, entryCell, rng) {
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
      const j = Math.floor(rng() * (i + 1));
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

// --- Phase 4c: Find path through carved letter (BFS) ---
function findLetterPath(grid, entry, exit, strokeCells) {
  const queue = [{ x: entry.x, y: entry.y, path: [{ x: entry.x, y: entry.y }] }];
  const seen = new Set([`${entry.x},${entry.y}`]);

  while (queue.length > 0) {
    const { x, y, path } = queue.shift();
    if (x === exit.x && y === exit.y) return path;

    for (const dir of ['top', 'right', 'bottom', 'left']) {
      if (grid[y][x].walls[dir]) continue;
      const nx = x + DIR_DX[dir];
      const ny = y + DIR_DY[dir];
      const nKey = `${nx},${ny}`;
      if (!strokeCells.has(nKey)) continue;
      if (seen.has(nKey)) continue;
      seen.add(nKey);
      queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
    }
  }
  return null;
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
export function generateWordMaze(text, gridWidth, gridHeight, fontData, rng) {
  if (!rng) rng = Math.random;
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

  // Phase 2b: Filter to outer stroke cells (ignore interior strokes for letters with holes)
  const charOuterStrokeCells = [];
  const charOutsideCells = [];
  for (let i = 0; i < characters.length; i++) {
    const { outerStroke, outside } = findOuterStrokeCells(charStrokeCells[i], gridWidth, gridHeight);
    charOuterStrokeCells.push(outerStroke);
    charOutsideCells.push(outside);
  }

  // Phase 3: Find entry/exit pairs using outer stroke cells, gates must face true outside
  const entryExitPairs = [];
  for (let i = 0; i < characters.length; i++) {
    const pair = findAdjacentEntryExitPair(charOuterStrokeCells[i], fixedWalls, gridWidth, gridHeight, charOutsideCells[i], rng, characters[i].x, characters[i].y);
    if (!pair) {
      entryExitPairs.push(null);
      continue;
    }
    // Open outer walls, add center wall + blocking wall
    applyEntryExit(fixedWalls, pair, gridWidth, gridHeight);
    entryExitPairs.push(pair);
  }

  // Build the grid
  const grid = Array.from({ length: gridHeight }, (_, y) =>
    Array.from({ length: gridWidth }, (_, x) => ({
      x, y, visited: false,
      walls: { top: true, right: true, bottom: true, left: true },
    }))
  );

  // Build set of all outer stroke cells (carved by DFS later)
  const allOuterStroke = new Set();
  for (const s of charOuterStrokeCells) {
    for (const key of s) allOuterStroke.add(key);
  }

  // Mark all stroke cells as visited in the grid (so maze filler skips them)
  // For INTERIOR stroke cells, remove non-fixed walls (open corridors like classic mode)
  // For OUTER stroke cells, leave walls intact — the DFS carver will handle them
  for (const key of allStrokeCells) {
    const [x, y] = key.split(',').map(Number);
    grid[y][x].visited = true;

    if (!allOuterStroke.has(key)) {
      // Interior stroke: clear non-fixed walls to make open corridors
      const cell = grid[y][x];
      const fixed = fixedWalls.get(key) || { top: false, right: false, bottom: false, left: false };
      if (!fixed.top && y > 0) { cell.walls.top = false; grid[y - 1][x].walls.bottom = false; }
      if (!fixed.right && x < gridWidth - 1) { cell.walls.right = false; grid[y][x + 1].walls.left = false; }
      if (!fixed.bottom && y < gridHeight - 1) { cell.walls.bottom = false; grid[y + 1][x].walls.top = false; }
      if (!fixed.left && x > 0) { cell.walls.left = false; grid[y][x - 1].walls.right = false; }
    }
  }

  const visitedCells = new Set(allStrokeCells);

  // Phase 4: Carve letter interiors (outer stroke cells only)
  for (let i = 0; i < characters.length; i++) {
    if (!entryExitPairs[i]) continue;
    const pair = entryExitPairs[i];

    // Reset visited state for OUTER stroke cells so DFS can traverse them
    for (const key of charOuterStrokeCells[i]) {
      const [x, y] = key.split(',').map(Number);
      grid[y][x].visited = false;
    }

    // Carve using outer stroke cells only
    carveLetterInterior(grid, fixedWalls, charOuterStrokeCells[i], pair.entry, rng);

    // Re-mark outer stroke cells as visited
    for (const key of charOuterStrokeCells[i]) {
      const [x, y] = key.split(',').map(Number);
      grid[y][x].visited = true;
    }
  }

  // Compute paths through each letter (for solution path, outer cells only)
  const letterPaths = [];
  for (let i = 0; i < characters.length; i++) {
    if (!entryExitPairs[i]) {
      letterPaths.push(null);
      continue;
    }
    const pair = entryExitPairs[i];
    letterPaths.push(findLetterPath(grid, pair.entry, pair.exit, charOuterStrokeCells[i]));
  }

  // Phase 4b: Open passages between entry/exit stroke cells and their outside cells
  for (let i = 0; i < characters.length; i++) {
    if (!entryExitPairs[i]) continue;
    const { entry, exit, separationDir, separationDirOpp } = entryExitPairs[i];

    // Open entry stroke cell -> outside cell
    grid[entry.y][entry.x].walls[entry.dir] = false;
    grid[entry.oy][entry.ox].walls[OPPOSITE[entry.dir]] = false;

    // Open exit stroke cell -> outside cell
    grid[exit.y][exit.x].walls[exit.dir] = false;
    grid[exit.oy][exit.ox].walls[OPPOSITE[exit.dir]] = false;

    // Add blocking wall between outside cells (prevents shortcutting)
    grid[entry.oy][entry.ox].walls[separationDir] = true;
    grid[exit.oy][exit.ox].walls[separationDirOpp] = true;
  }

  // Phase 5: Carve external paths between consecutive letters
  const externalPaths = [];
  for (let i = 0; i < characters.length - 1; i++) {
    if (!entryExitPairs[i] || !entryExitPairs[i + 1]) {
      externalPaths.push(null);
      continue;
    }

    const exitPair = entryExitPairs[i].exit;
    const entryPair = entryExitPairs[i + 1].entry;
    const fromCell = { x: exitPair.ox, y: exitPair.oy };
    const toCell = { x: entryPair.ox, y: entryPair.oy };

    const path = carveExternalPath(grid, fixedWalls, fromCell, toCell, gridWidth, gridHeight, visitedCells, allStrokeCells);
    externalPaths.push(path);
  }

  // Build full solution path
  const solutionPath = [];
  for (let i = 0; i < characters.length; i++) {
    if (!entryExitPairs[i]) continue;
    const pair = entryExitPairs[i];

    // Outside entry cell
    solutionPath.push({ x: pair.entry.ox, y: pair.entry.oy });
    // Path through letter
    if (letterPaths[i]) {
      solutionPath.push(...letterPaths[i]);
    }
    // Outside exit cell
    solutionPath.push({ x: pair.exit.ox, y: pair.exit.oy });
    // External path to next letter
    if (i < externalPaths.length && externalPaths[i]) {
      solutionPath.push(...externalPaths[i]);
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
