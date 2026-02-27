// wordMazeGenerator.js
// Generates a word maze where the solution path visits each letter in order.
// Each letter is a sealed "closed box" with a single entry/exit point.
// The solver must trace the letter's contour to get from entry to exit.

import { recursiveBacktracker } from './mazeGenerator';

// --- Constants (mirrored from SvgGrid.jsx) ---
const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 14;
const CHAR_PADDING_UNITS =2
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

// Returns {hFactor, vFactor} in 0..1 for a position string
function getPositionFactors(position) {
  const hMap = {
    'top-left': 0, 'left': 0, 'bottom-left': 0,
    'top': 0.5, 'center': 0.5, 'bottom': 0.5,
    'top-right': 1, 'right': 1, 'bottom-right': 1,
  };
  const vMap = {
    'top-left': 0, 'top': 0, 'top-right': 0,
    'left': 0.5, 'center': 0.5, 'right': 0.5,
    'bottom-left': 1, 'bottom': 1, 'bottom-right': 1,
  };
  return { hFactor: hMap[position] ?? 0.5, vFactor: vMap[position] ?? 0.5 };
}
const DIR_DX = { top: 0, bottom: 0, left: -1, right: 1 };
const DIR_DY = { top: -1, bottom: 1, left: 0, right: 0 };

// --- Phase 1: Calculate optimal cell size and layout characters ---
function calculateOptimalLayoutAndCellSize(text, gridWidthUnits, gridHeightUnits, sizingMode = 'autofit', position = 'center', textAlign = 'center') {
  if (sizingMode === 'standard') {
    return calculateStandardLayout(text, gridWidthUnits, gridHeightUnits, position, textAlign);
  } else if (sizingMode === 'autofit') {
    return calculateCompactLayout(text, gridWidthUnits, gridHeightUnits, position, textAlign);
  }
  return calculateAutofitLayout(text, gridWidthUnits, gridHeightUnits, position, textAlign);
}

// Standard mode: Fixed cell size, word wrapping, position-aware placement
function calculateStandardLayout(text, gridWidthUnits, gridHeightUnits, position = 'center', textAlign = 'center') {
  const cellWidth = CHAR_CELL_WIDTH_UNITS;
  const cellHeight = CHAR_CELL_HEIGHT_UNITS;
  const words = text.split(' ');

  const charsPerRow = Math.floor(gridWidthUnits / cellWidth);
  const tempLayout = [];
  let currentRow = 0;
  let currentCol = 0;

  for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
    const word = words[wordIdx];
    const wordLength = word.length;

    if (currentCol > 0 && currentCol + wordLength > charsPerRow) {
      currentRow++;
      currentCol = 0;
    }

    for (const char of word) {
      tempLayout.push({ char, row: currentRow, col: currentCol });
      currentCol++;
    }

    if (wordIdx < words.length - 1) {
      tempLayout.push({ char: ' ', row: currentRow, col: currentCol });
      currentCol++;
    }
  }

  const totalRows = currentRow + 1;
  const totalRowsInGrid = Math.floor(gridHeightUnits / cellHeight);

  // Per-row widths for alignment
  const rowWidths = {};
  for (const item of tempLayout) {
    rowWidths[item.row] = Math.max(rowWidths[item.row] ?? 0, item.col + 1);
  }
  const maxUsedCols = Object.values(rowWidths).length > 0
    ? Math.max(...Object.values(rowWidths))
    : 0;

  const { hFactor, vFactor } = getPositionFactors(position);
  const verticalOffset = Math.floor(Math.max(0, totalRowsInGrid - totalRows) * vFactor);
  const horizontalOffset = Math.floor(Math.max(0, charsPerRow - maxUsedCols) * hFactor);

  const characters = tempLayout.map((item, index) => {
    const rowW = rowWidths[item.row] ?? 0;
    const alignOffset = textAlign === 'left' ? 0
      : textAlign === 'right' ? maxUsedCols - rowW
      : Math.floor((maxUsedCols - rowW) / 2);
    const x = (item.col + horizontalOffset + alignOffset) * cellWidth;
    const y = (item.row + verticalOffset) * cellHeight;

    if ((x + cellWidth) > gridWidthUnits || (y + cellHeight) > gridHeightUnits) {
      return null;
    }

    return { char: item.char, x, y, index };
  }).filter(Boolean);

  return {
    characters,
    cellWidth,
    cellHeight,
    contentWidth: CHAR_CONTENT_WIDTH,
    contentHeight: CHAR_CONTENT_HEIGHT,
    paddingUnits: CHAR_PADDING_UNITS
  };
}

// Compact mode: Each word on its own line, using natural cell sizes.
// The grid passed in is already sized to the text block (see SvgGrid.jsx),
// which causes SvgGrid to scale px/unit upward so letters appear large.
// Position controls where the text block sits within the (possibly wider/taller) grid.
function calculateCompactLayout(text, gridWidthUnits, gridHeightUnits, position = 'center', textAlign = 'center') {
  const words = text.split(' ').filter(w => w.length > 0);
  const longestWordLength = Math.max(...words.map(w => w.length), 1);
  const numWords = words.length;

  const cellWidth = CHAR_CELL_WIDTH_UNITS;
  const cellHeight = CHAR_CELL_HEIGHT_UNITS;
  const charsPerRow = longestWordLength;

  // Place each word on its own line, aligned within the text block
  const tempLayout = [];
  for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
    const word = words[wordIdx];
    const wordOffset = textAlign === 'left' ? 0
      : textAlign === 'right' ? charsPerRow - word.length
      : Math.floor((charsPerRow - word.length) / 2);
    for (let charIdx = 0; charIdx < word.length; charIdx++) {
      tempLayout.push({ char: word[charIdx], row: wordIdx, col: wordOffset + charIdx });
    }
  }

  const totalRowsInGrid = Math.floor(gridHeightUnits / cellHeight);
  const charsPerGridRow = Math.floor(gridWidthUnits / cellWidth);

  const { hFactor, vFactor } = getPositionFactors(position);
  const verticalOffset = Math.floor(Math.max(0, totalRowsInGrid - numWords) * vFactor);
  const horizontalGridOffset = Math.floor(Math.max(0, charsPerGridRow - charsPerRow) * hFactor);

  const characters = tempLayout.map((item, index) => {
    const x = (item.col + horizontalGridOffset) * cellWidth;
    const y = (item.row + verticalOffset) * cellHeight;

    if ((x + cellWidth) > gridWidthUnits || (y + cellHeight) > gridHeightUnits) {
      return null;
    }

    return { char: item.char, x, y, index };
  }).filter(Boolean);

  return {
    characters,
    cellWidth,
    cellHeight,
    contentWidth: CHAR_CONTENT_WIDTH,
    contentHeight: CHAR_CONTENT_HEIGHT,
    paddingUnits: CHAR_PADDING_UNITS,
  };
}

// Autofit mode: Scales cells to fit the longest line, position-aware vertical placement
function calculateAutofitLayout(text, gridWidthUnits, gridHeightUnits, position = 'center', textAlign = 'center') {
  // Try with maximum of 2 rows
  const MAX_ROWS = 2;
  const words = text.split(' ');

  // Calculate optimal cell width to fit longest line in grid width
  let bestLayout = null;
  let bestCellWidth = CHAR_CELL_WIDTH_UNITS;
  let longestLineChars = 0;

  // First, simulate layout to find longest line
  const charsPerGridRow = Math.floor(gridWidthUnits / CHAR_CELL_WIDTH_UNITS);
  const tempLayout = [];
  let currentRow = 0;
  let currentCol = 0;
  let maxColInRow = 0;

  for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
    const word = words[wordIdx];
    const wordLength = word.length;

    // Check if word fits on current row
    if (currentCol > 0 && currentCol + wordLength > charsPerGridRow) {
      maxColInRow = Math.max(maxColInRow, currentCol);
      currentRow++;
      currentCol = 0;
    }

    // Stop if exceeding max rows
    if (currentRow >= MAX_ROWS) break;

    // Add word characters
    for (const char of word) {
      tempLayout.push({ char, row: currentRow, col: currentCol });
      currentCol++;
    }

    // Add space after word (if not last word)
    if (wordIdx < words.length - 1) {
      tempLayout.push({ char: ' ', row: currentRow, col: currentCol });
      currentCol++;
    }
  }

  // Final row max
  maxColInRow = Math.max(maxColInRow, currentCol);
  longestLineChars = maxColInRow;

  // Calculate optimal cell width to fit longest line with some margin
  const MARGIN_CHARS = 1; // Leave space for 1 char on each side
  const availableWidth = gridWidthUnits;
  const targetChars = longestLineChars + MARGIN_CHARS;
  const optimalCellWidth = Math.floor(availableWidth / targetChars);

  // Scale cell height proportionally (maintain aspect ratio)
  const scaleFactor = optimalCellWidth / CHAR_CELL_WIDTH_UNITS;
  const scaledCellHeight = Math.floor(CHAR_CELL_HEIGHT_UNITS * scaleFactor);

  // Recalculate layout with new cell dimensions
  const scaledCellWidthUnits = optimalCellWidth;
  const scaledCellHeightUnits = scaledCellHeight;

  const charsPerRow = Math.floor(gridWidthUnits / scaledCellWidthUnits);
  const finalLayout = [];
  currentRow = 0;
  currentCol = 0;

  for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
    const word = words[wordIdx];
    const wordLength = word.length;

    // Check if word fits on current row
    if (currentCol > 0 && currentCol + wordLength > charsPerRow) {
      currentRow++;
      currentCol = 0;
    }

    // Add word characters
    for (const char of word) {
      finalLayout.push({ char, row: currentRow, col: currentCol });
      currentCol++;
    }

    // Add space after word (if not last word)
    if (wordIdx < words.length - 1) {
      finalLayout.push({ char: ' ', row: currentRow, col: currentCol });
      currentCol++;
    }
  }

  // Calculate vertical placement based on position
  const totalRows = currentRow + 1;
  const totalRowsInGrid = Math.floor(gridHeightUnits / scaledCellHeightUnits);
  const { vFactor } = getPositionFactors(position);
  const verticalOffset = Math.floor(Math.max(0, totalRowsInGrid - totalRows) * vFactor);

  // Per-row widths for alignment
  const rowWidths = {};
  for (const item of finalLayout) {
    rowWidths[item.row] = Math.max(rowWidths[item.row] ?? 0, item.col + 1);
  }
  const maxRowWidth = Object.values(rowWidths).length > 0 ? Math.max(...Object.values(rowWidths)) : 0;

  const characters = finalLayout.map((item, index) => {
    const rowW = rowWidths[item.row] ?? 0;
    const alignOffset = textAlign === 'left' ? 0
      : textAlign === 'right' ? maxRowWidth - rowW
      : Math.floor((maxRowWidth - rowW) / 2);
    const x = (item.col + alignOffset) * scaledCellWidthUnits;
    const y = (item.row + verticalOffset) * scaledCellHeightUnits;

    if ((x + scaledCellWidthUnits) > gridWidthUnits || (y + scaledCellHeightUnits) > gridHeightUnits) {
      return null;
    }

    return { char: item.char, x, y, index };
  }).filter(Boolean);

  return {
    characters,
    cellWidth: scaledCellWidthUnits,
    cellHeight: scaledCellHeightUnits,
    contentWidth: Math.floor(CHAR_CONTENT_WIDTH * scaleFactor),
    contentHeight: Math.floor(CHAR_CONTENT_HEIGHT * scaleFactor),
    paddingUnits: Math.floor(CHAR_PADDING_UNITS * scaleFactor)
  };
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
// Scans the FULL character cell (including padding rows/cols) because some
// characters ($, &, #) have font segments extending into/beyond the padding area.
function detectStrokesForChar(charX, charY, fixedWalls, gridW, gridH, cellConfig) {
  const { cellWidth, cellHeight } = cellConfig;
  // Full character cell area (including padding)
  const charCells = new Set();
  for (let dy = 0; dy < cellHeight; dy++) {
    for (let dx = 0; dx < cellWidth; dx++) {
      const gx = charX + dx;
      const gy = charY + dy;
      if (gx >= 0 && gx < gridW && gy >= 0 && gy < gridH) {
        charCells.add(`${gx},${gy}`);
      }
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
  for (let dy = 0; dy < cellHeight; dy++) {
    for (let dx = 0; dx < cellWidth; dx++) {
      const x = charX + dx;
      const y = charY + dy;
      if (x < 0 || x >= gridW || y < 0 || y >= gridH) continue;
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
      if (!charCells.has(nKey)) continue;
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
    for (let dy = 0; dy < cellHeight; dy++) {
      for (let dx = 0; dx < cellWidth; dx++) {
        const x = charX + dx;
        const y = charY + dy;
        if (x < 0 || x >= gridW || y < 0 || y >= gridH) continue;
        const key = `${x},${y}`;
        if (enclosedCorridors.has(key)) continue;
        if (!charCells.has(key)) continue;

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
// "Outer stroke" = stroke cells reachable from the outside through unfixed walls.
// 1. Flood fill from grid edges through non-stroke cells → "outside"
// 2. Seed: stroke cells adjacent to at least one outside cell
// 3. Flood fill through stroke cells respecting fixed walls → outer strokes
// This correctly handles: @ inner ring (separated by walls), 8 corners, L junctions.
function findOuterStrokeCells(strokeCells, gridW, gridH, fixedWalls) {
  // Step 1: find "outside" cells (non-stroke, reachable from grid edges)
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

  // Step 2: seed outer strokes = stroke cells adjacent to at least one outside cell
  const outerStroke = new Set();
  const fillQueue = [];
  for (const key of strokeCells) {
    const [x, y] = key.split(',').map(Number);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (outside.has(`${nx},${ny}`)) {
        outerStroke.add(key);
        fillQueue.push(key);
        break;
      }
    }
  }

  // Step 3: flood fill from seeds through connected stroke cells (respecting fixed walls)
  while (fillQueue.length > 0) {
    const key = fillQueue.shift();
    const [x, y] = key.split(',').map(Number);
    const neighbors = [
      { dir: 'right', nx: x + 1, ny: y },
      { dir: 'left', nx: x - 1, ny: y },
      { dir: 'bottom', nx: x, ny: y + 1 },
      { dir: 'top', nx: x, ny: y - 1 },
    ];
    for (const { dir, nx, ny } of neighbors) {
      const nKey = `${nx},${ny}`;
      if (outerStroke.has(nKey)) continue;
      if (!strokeCells.has(nKey)) continue;
      // Only cross if no fixed wall blocks passage
      if (hasWall(fixedWalls, x, y, dir)) continue;
      if (hasWall(fixedWalls, nx, ny, OPPOSITE[dir])) continue;
      outerStroke.add(nKey);
      fillQueue.push(nKey);
    }
  }

  // Step 4: Keep only the largest connected component of outer strokes
  // (handles characters like $ where the descender is disconnected from the main ring)
  if (outerStroke.size > 0) {
    const components = [];
    const assigned = new Set();
    for (const key of outerStroke) {
      if (assigned.has(key)) continue;
      const component = new Set();
      const cQueue = [key];
      component.add(key);
      assigned.add(key);
      while (cQueue.length > 0) {
        const cKey = cQueue.shift();
        const [cx, cy] = cKey.split(',').map(Number);
        const cNeighbors = [
          { dir: 'right', nx: cx + 1, ny: cy },
          { dir: 'left', nx: cx - 1, ny: cy },
          { dir: 'bottom', nx: cx, ny: cy + 1 },
          { dir: 'top', nx: cx, ny: cy - 1 },
        ];
        for (const { dir, nx, ny } of cNeighbors) {
          const nKey = `${nx},${ny}`;
          if (assigned.has(nKey)) continue;
          if (!outerStroke.has(nKey)) continue;
          if (hasWall(fixedWalls, cx, cy, dir)) continue;
          if (hasWall(fixedWalls, nx, ny, OPPOSITE[dir])) continue;
          component.add(nKey);
          assigned.add(nKey);
          cQueue.push(nKey);
        }
      }
      components.push(component);
    }
    // Replace outerStroke with the largest component
    let largest = components[0];
    for (const c of components) {
      if (c.size > largest.size) largest = c;
    }
    return { outerStroke: largest, outside };
  }

  return { outerStroke, outside };
}

// --- Phase 3: Find adjacent entry/exit pair ---
// Finds two ADJACENT stroke cells that both face the same outer direction.
// They are separated by a center wall (added if not present), forcing the solver
// to traverse the entire letter corridor to get from entry to exit.
// Prefers gates opening onto PADDING (better for multi-letter BFS routing),
// but falls back to content-area gates for compact characters like *.
// Uses rng to randomly select from all valid candidates.
// allStrokeCells: stroke cells of ALL letters — used to prefer gates whose
// outside cells have at least one free (non-stroke) neighbor so the BFS can escape.
function findAdjacentEntryExitPair(strokeCells, fixedWalls, gridW, gridH, outsideCells, rng, charX, charY, cellConfig, allStrokeCells) {
  const { contentWidth, contentHeight, paddingUnits } = cellConfig;
  // Content area: the area inside the padding border
  const contentMinX = charX + paddingUnits;
  const contentMaxX = charX + paddingUnits + contentWidth;
  const contentMinY = charY + paddingUnits;
  const contentMaxY = charY + paddingUnits + contentHeight;
  const isInContent = (cx, cy) => cx >= contentMinX && cx < contentMaxX && cy >= contentMinY && cy < contentMaxY;

  const paddingCandidates = [];  // outside cells in padding (preferred)
  const contentCandidates = [];  // outside cells in content (fallback)

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

      const nx = x + DIR_DX[sepDir];
      const ny = y + DIR_DY[sepDir];
      if (!strokeCells.has(`${nx},${ny}`)) continue;
      if (!hasWall(fixedWalls, nx, ny, outerDir)) continue;

      const nox = nx + DIR_DX[outerDir];
      const noy = ny + DIR_DY[outerDir];
      if (nox < 0 || nox >= gridW || noy < 0 || noy >= gridH) continue;
      if (!outsideCells.has(`${nox},${noy}`)) continue;

      const candidate = {
        entry: { x, y, dir: outerDir, ox, oy },
        exit: { x: nx, y: ny, dir: outerDir, ox: nox, oy: noy },
        separationDir: sepDir,
        separationDirOpp: sepDirOpp,
      };

      if (isInContent(ox, oy) || isInContent(nox, noy)) {
        contentCandidates.push(candidate);
      } else {
        paddingCandidates.push(candidate);
      }
    }
  }

  // Prefer padding gates; fall back to content gates for compact characters
  const candidates = paddingCandidates.length > 0 ? paddingCandidates : contentCandidates;
  if (candidates.length === 0) return null;

  // Score how many non-allStroke free neighbors each candidate's outside cells have.
  // Higher score = better chance the BFS can escape to free space from that gate.
  function gateEscapeScore(candidate) {
    if (!allStrokeCells) return 0;
    const { entry, exit } = candidate;
    let score = 0;
    for (const [ox, oy] of [[entry.ox, entry.oy], [exit.ox, exit.oy]]) {
      for (const [nx, ny] of [[ox - 1, oy], [ox + 1, oy], [ox, oy - 1], [ox, oy + 1]]) {
        if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH && !allStrokeCells.has(`${nx},${ny}`)) {
          score++;
        }
      }
    }
    return score;
  }

  // Prefer gates where the separation wall keeps all strokes reachable (simple cycles).
  // For branching topologies ($, &), fall back to best gate without connectivity requirement.
  const connectedCandidates = candidates.filter(candidate => {
    return isGateConnected(candidate, strokeCells, fixedWalls);
  });

  if (connectedCandidates.length > 0) {
    // Among connected candidates, prefer those with escape routes from their outside cells.
    const withEscape = connectedCandidates.filter(c => gateEscapeScore(c) > 0);
    const pool = withEscape.length > 0 ? withEscape : connectedCandidates;
    return pool[Math.floor(rng() * pool.length)];
  }

  // Fallback: pick the gate that maximizes reachable cells from entry,
  // breaking ties in favour of candidates with better escape scores.
  let bestCandidate = null;
  let bestReachable = 0;
  let bestEscape = -1;
  for (const candidate of candidates) {
    const reachable = countReachable(candidate, strokeCells, fixedWalls);
    const escape = gateEscapeScore(candidate);
    if (reachable > bestReachable || (reachable === bestReachable && escape > bestEscape)) {
      bestReachable = reachable;
      bestEscape = escape;
      bestCandidate = candidate;
    }
  }
  return bestCandidate;
}

// Check that after adding the separation wall, all outer stroke cells
// are still reachable from the entry cell via BFS respecting fixed walls.
function isGateConnected(candidate, strokeCells, fixedWalls) {
  const { entry, exit, separationDir, separationDirOpp } = candidate;
  // Simulate the separation wall: entry -> exit direction is blocked
  // We check: can BFS from entry reach ALL stroke cells without crossing
  // the separation wall between entry and exit?
  const visited = new Set();
  const queue = [`${entry.x},${entry.y}`];
  visited.add(queue[0]);

  while (queue.length > 0) {
    const key = queue.shift();
    const [x, y] = key.split(',').map(Number);
    const neighbors = [
      { dir: 'right', nx: x + 1, ny: y },
      { dir: 'left', nx: x - 1, ny: y },
      { dir: 'bottom', nx: x, ny: y + 1 },
      { dir: 'top', nx: x, ny: y - 1 },
    ];
    for (const { dir, nx, ny } of neighbors) {
      const nKey = `${nx},${ny}`;
      if (visited.has(nKey)) continue;
      if (!strokeCells.has(nKey)) continue;
      // Check fixed walls
      if (hasWall(fixedWalls, x, y, dir)) continue;
      if (hasWall(fixedWalls, nx, ny, OPPOSITE[dir])) continue;
      // Check simulated separation wall
      if (x === entry.x && y === entry.y && dir === separationDir) continue;
      if (x === exit.x && y === exit.y && dir === separationDirOpp) continue;
      visited.add(nKey);
      queue.push(nKey);
    }
  }

  return visited.size === strokeCells.size;
}

// Count how many stroke cells are reachable from entry with the separation wall.
function countReachable(candidate, strokeCells, fixedWalls) {
  const { entry, exit, separationDir, separationDirOpp } = candidate;
  const visited = new Set();
  const queue = [`${entry.x},${entry.y}`];
  visited.add(queue[0]);

  while (queue.length > 0) {
    const key = queue.shift();
    const [x, y] = key.split(',').map(Number);
    const neighbors = [
      { dir: 'right', nx: x + 1, ny: y },
      { dir: 'left', nx: x - 1, ny: y },
      { dir: 'bottom', nx: x, ny: y + 1 },
      { dir: 'top', nx: x, ny: y - 1 },
    ];
    for (const { dir, nx, ny } of neighbors) {
      const nKey = `${nx},${ny}`;
      if (visited.has(nKey)) continue;
      if (!strokeCells.has(nKey)) continue;
      if (hasWall(fixedWalls, x, y, dir)) continue;
      if (hasWall(fixedWalls, nx, ny, OPPOSITE[dir])) continue;
      if (x === entry.x && y === entry.y && dir === separationDir) continue;
      if (x === exit.x && y === exit.y && dir === separationDirOpp) continue;
      visited.add(nKey);
      queue.push(nKey);
    }
  }

  return visited.size;
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

// --- Phase 5: Free-pass BFS (last-resort fallback) ---
// Same as carveExternalPath but ignores the visitedCells constraint.
// This guarantees a path whenever the grid is connected through non-stroke cells,
// regardless of what earlier carving has already claimed as visited.
// Used when all 3 normal BFS attempts fail (e.g. visitedCells blocks every route).
function carveFreeExternalPath(grid, fixedWalls, fromCell, toCell, gridW, gridH, allStrokeCells, visitedCells, rng) {
  const manhattanDist = (x, y) => Math.abs(x - toCell.x) + Math.abs(y - toCell.y);

  const queue = [{
    x: fromCell.x, y: fromCell.y,
    path: [{ x: fromCell.x, y: fromCell.y }],
    priority: 0,
  }];
  const seen = new Set([`${fromCell.x},${fromCell.y}`]);

  while (queue.length > 0) {
    queue.sort((a, b) => a.priority - b.priority);
    const { x, y, path } = queue.shift();

    if (x === toCell.x && y === toCell.y) {
      for (let i = 0; i < path.length - 1; i++) {
        const curr = path[i], next = path[i + 1];
        const dx = next.x - curr.x, dy = next.y - curr.y;
        const dir = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'bottom' : 'top';
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
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    for (const dir of dirs) {
      const nx = x + DIR_DX[dir], ny = y + DIR_DY[dir];
      const nKey = `${nx},${ny}`;
      if (seen.has(nKey)) continue;
      if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
      // Allow the target even if it's a stroke cell
      if (nKey !== `${toCell.x},${toCell.y}` && allStrokeCells.has(nKey)) continue;
      if (hasWall(fixedWalls, x, y, dir)) continue;
      if (hasWall(fixedWalls, nx, ny, OPPOSITE[dir])) continue;
      seen.add(nKey);
      const priority = manhattanDist(nx, ny) + rng() * 2; // small random jitter
      queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }], priority });
    }
  }

  return null; // Grid is completely disconnected (extremely rare)
}

// --- Phase 5: Carve external path between letters (BFS) ---
function carveExternalPath(grid, fixedWalls, fromCell, toCell, gridW, gridH, visitedCells, allStrokeCells, rng) {
  // Helper to calculate Manhattan distance to target
  const manhattanDist = (x, y) => Math.abs(x - toCell.x) + Math.abs(y - toCell.y);
  const totalDistance = manhattanDist(fromCell.x, fromCell.y);

  // Adaptive random factor based on distance
  // Longer paths get more randomness (up to 4), shorter paths less (down to 1)
  const maxRandomFactor = Math.min(4, Math.max(1, totalDistance / 5));

  // Try with decreasing randomness levels (fallback strategy)
  for (let attempt = 0; attempt < 3; attempt++) {
    const randomScale = attempt === 0 ? 1.0 : attempt === 1 ? 0.5 : 0.0; // 100%, 50%, 0%
    const currentMaxRandom = maxRandomFactor * randomScale;

    const queue = [{
      x: fromCell.x,
      y: fromCell.y,
      path: [{ x: fromCell.x, y: fromCell.y }],
      priority: 0
    }];
    const seen = new Set();
    seen.add(`${fromCell.x},${fromCell.y}`);

    while (queue.length > 0) {
      // Sort by priority (lower is better) - this adds the bias
      queue.sort((a, b) => a.priority - b.priority);
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

      // Shuffle directions for randomness (only if randomScale > 0)
      const dirs = ['top', 'right', 'bottom', 'left'];
      if (randomScale > 0) {
        for (let i = dirs.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
        }
      }

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

        // Calculate priority: distance to target + random factor
        // Lower priority = explored first
        const distance = manhattanDist(nx, ny);
        const randomFactor = rng() * currentMaxRandom;
        const priority = distance + randomFactor;

        queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }], priority });
      }
    }

    // If we got here, this attempt failed - try next attempt with less randomness
  }

  // Attempt 3: free-pass BFS — ignores visitedCells constraint.
  // Works whenever the grid is connected through non-stroke cells.
  return carveFreeExternalPath(grid, fixedWalls, fromCell, toCell, gridW, gridH, allStrokeCells, visitedCells, rng);
}

// --- Phase 6: Fill remaining space with maze ---
function fillRemainingSpace(grid, fixedWalls, gridW, gridH, verticalBias = 1) {
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!grid[y][x].visited) {
        recursiveBacktracker(grid, grid[y][x], fixedWalls, verticalBias);
      }
    }
  }
}

// --- Main entry point ---
export function generateWordMaze(text, gridWidth, gridHeight, fontData, rng, sizingMode = 'autofit', verticalBias = 1, position = 'center', textAlign = 'center') {
  if (!rng) rng = Math.random;
  if (!text || gridWidth <= 0 || gridHeight <= 0) {
    return { walls: [], solutionPath: [], characters: [], startCell: null, endCell: null, cellConfig: null };
  }

  // Phase 1: Calculate optimal cell size and layout characters (based on sizing mode)
  const layoutResult = calculateOptimalLayoutAndCellSize(text, gridWidth, gridHeight, sizingMode, position, textAlign);
  const characters = layoutResult.characters;
  const cellConfig = {
    cellWidth: layoutResult.cellWidth,
    cellHeight: layoutResult.cellHeight,
    contentWidth: layoutResult.contentWidth,
    contentHeight: layoutResult.contentHeight,
    paddingUnits: layoutResult.paddingUnits
  };


  if (characters.length === 0) {
    return { walls: [], solutionPath: [], characters: [], startCell: null, endCell: null, cellConfig };
  }

  // For autofit mode, use the reduced grid width
  const effectiveGridWidth = (sizingMode === 'autofit' && layoutResult.compactGridWidth)
    ? Math.ceil(layoutResult.compactGridWidth)
    : gridWidth;

  // Phase 1b: Build fixed walls from font data
  const fixedWalls = fontWallsToFixedWalls(characters, effectiveGridWidth, gridHeight, fontData);

  // Phase 2: Detect stroke cells for each character
  const charStrokeCells = [];
  const allStrokeCells = new Set();
  for (const charInfo of characters) {
    const strokes = detectStrokesForChar(charInfo.x, charInfo.y, fixedWalls, effectiveGridWidth, gridHeight, cellConfig);
    charStrokeCells.push(strokes);
    for (const key of strokes) {
      allStrokeCells.add(key);
    }
  }

  // Phase 2b: Filter to outer stroke cells (ignore interior strokes for letters with holes)
  const charOuterStrokeCells = [];
  const charOutsideCells = [];
  for (let i = 0; i < characters.length; i++) {
    const { outerStroke, outside } = findOuterStrokeCells(charStrokeCells[i], effectiveGridWidth, gridHeight, fixedWalls);
    charOuterStrokeCells.push(outerStroke);
    charOutsideCells.push(outside);
  }

  // Phase 3: Find entry/exit pairs using outer stroke cells, gates must face true outside
  // Skip spaces - they don't have strokes or entry/exit pairs
  const entryExitPairs = [];
  for (let i = 0; i < characters.length; i++) {
    // Skip spaces
    if (characters[i].char === ' ') {
      entryExitPairs.push(null);
      continue;
    }

    const pair = findAdjacentEntryExitPair(charOuterStrokeCells[i], fixedWalls, effectiveGridWidth, gridHeight, charOutsideCells[i], rng, characters[i].x, characters[i].y, cellConfig, allStrokeCells);
    if (!pair) {
      entryExitPairs.push(null);
      continue;
    }
    // Open outer walls, add center wall + blocking wall
    applyEntryExit(fixedWalls, pair, effectiveGridWidth, gridHeight);
    entryExitPairs.push(pair);
  }

  // Build the grid
  const grid = Array.from({ length: gridHeight }, (_, y) =>
    Array.from({ length: effectiveGridWidth }, (_, x) => ({
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
      if (!fixed.right && x < effectiveGridWidth - 1) { cell.walls.right = false; grid[y][x + 1].walls.left = false; }
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

  // Phase 5a: Carve path from (0,0) to first letter's entry
  const firstPair = entryExitPairs.find(pair => pair !== null);
  const startCorner = { x: 0, y: 0 };
  const pathToFirstLetter = firstPair
    ? carveExternalPath(grid, fixedWalls, startCorner, { x: firstPair.entry.ox, y: firstPair.entry.oy }, effectiveGridWidth, gridHeight, visitedCells, allStrokeCells, rng)
    : null;

  // Phase 5b: Carve external paths between consecutive non-space letters
  // Skip spaces when connecting - connect letter to next non-space letter
  const externalPaths = [];
  for (let i = 0; i < characters.length - 1; i++) {
    if (!entryExitPairs[i]) {
      externalPaths.push(null);
      continue;
    }

    // Find next non-space letter
    let nextLetterIdx = i + 1;
    while (nextLetterIdx < characters.length && !entryExitPairs[nextLetterIdx]) {
      nextLetterIdx++;
    }

    if (nextLetterIdx >= characters.length) {
      externalPaths.push(null);
      continue;
    }

    const exitPair = entryExitPairs[i].exit;
    const entryPair = entryExitPairs[nextLetterIdx].entry;
    const fromCell = { x: exitPair.ox, y: exitPair.oy };
    const toCell = { x: entryPair.ox, y: entryPair.oy };

    const path = carveExternalPath(grid, fixedWalls, fromCell, toCell, effectiveGridWidth, gridHeight, visitedCells, allStrokeCells, rng);
    externalPaths.push(path);
  }

  // Phase 5c: Carve path from last letter's exit to bottom-right corner
  const lastPairIdx = entryExitPairs.map((p, i) => p ? i : -1).filter(i => i !== -1).pop();
  const lastPair = lastPairIdx !== undefined ? entryExitPairs[lastPairIdx] : null;
  const endCorner = { x: effectiveGridWidth - 1, y: gridHeight - 1 };
  const pathFromLastLetter = lastPair
    ? carveExternalPath(grid, fixedWalls, { x: lastPair.exit.ox, y: lastPair.exit.oy }, endCorner, effectiveGridWidth, gridHeight, visitedCells, allStrokeCells, rng)
    : null;

  // Build full solution path (from top-left corner to bottom-right corner)
  const solutionPath = [];

  // Start at (0,0)
  if (pathToFirstLetter) {
    solutionPath.push(...pathToFirstLetter);
  }

  // Path through each letter
  let pathIndex = 0;
  for (let i = 0; i < characters.length; i++) {
    if (!entryExitPairs[i]) continue;
    const pair = entryExitPairs[i];

    // Path through letter
    if (letterPaths[i]) {
      solutionPath.push(...letterPaths[i]);
    }
    // Outside exit cell
    solutionPath.push({ x: pair.exit.ox, y: pair.exit.oy });
    // External path to next letter (use pathIndex to track external paths)
    if (pathIndex < externalPaths.length && externalPaths[pathIndex]) {
      solutionPath.push(...externalPaths[pathIndex]);
    }
    pathIndex++;
  }

  // End at bottom-right corner
  if (pathFromLastLetter) {
    solutionPath.push(...pathFromLastLetter);
  }

  // Phase 6: Fill remaining space with maze
  fillRemainingSpace(grid, fixedWalls, effectiveGridWidth, gridHeight, verticalBias);

  // Phase 7: Define start and end at corners
  const startCell = { x: 0, y: 0 };
  const endCell = { x: effectiveGridWidth - 1, y: gridHeight - 1 };

  // Convert grid to wall segments
  const walls = [];
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < effectiveGridWidth; x++) {
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
    cellConfig, // Include dynamic cell dimensions
  };
}
