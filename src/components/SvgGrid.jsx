import React, { useMemo } from 'react';
import fontData from '../assets/maze-font.json';
import { recursiveBacktracker } from '../lib/mazeGenerator';
import { generateWordMaze } from '../lib/wordMazeGenerator';

// --- CONSTANTS ---
const UNIT_SIZE = 17;
const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 12;
const CHAR_PADDING_UNITS = 1;

export const CHAR_CELL_WIDTH_UNITS = CHAR_CONTENT_WIDTH + CHAR_PADDING_UNITS * 2;
export const CHAR_CELL_HEIGHT_UNITS = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2;
export const UNIT_SIZE_EXPORT = UNIT_SIZE;

// --- HELPER TO CONVERT FONT WALLS TO FIXED CELL WALLS ---
function fontWallsToFixedWalls(characters, gridWidth, gridHeight) {
  const fixedWalls = new Map();

  const setFixed = (x, y, dir) => {
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return;
    const key = `${x},${y}`;
    if (!fixedWalls.has(key)) {
      fixedWalls.set(key, { top: false, right: false, bottom: false, left: false });
    }
    fixedWalls.get(key)[dir] = true;
  };

  for (const { char, x: charX, y: charY } of characters) {
    const charData = fontData[char.toUpperCase()];
    if (!charData) continue;

    for (const [x1, y1, x2, y2] of charData) {
      // Convert font coordinates to grid coordinates
      // Font uses 1-indexed coords, transformation: (fx - 1 + CHAR_PADDING_UNITS) = fx (when padding=1)
      const gx1 = charX + x1;
      const gy1 = charY + y1;
      const gx2 = charX + x2;
      const gy2 = charY + y2;

      if (gx1 === gx2) {
        // Vertical wall segment
        const gx = gx1;
        const minY = Math.min(gy1, gy2);
        const maxY = Math.max(gy1, gy2);
        for (let gy = minY; gy < maxY; gy++) {
          // This wall is the right edge of cell (gx-1, gy) and left edge of cell (gx, gy)
          setFixed(gx - 1, gy, 'right');
          setFixed(gx, gy, 'left');
        }
      } else if (gy1 === gy2) {
        // Horizontal wall segment
        const gy = gy1;
        const minX = Math.min(gx1, gx2);
        const maxX = Math.max(gx1, gx2);
        for (let gx = minX; gx < maxX; gx++) {
          // This wall is the bottom edge of cell (gx, gy-1) and top edge of cell (gx, gy)
          setFixed(gx, gy - 1, 'bottom');
          setFixed(gx, gy, 'top');
        }
      }
    }
  }

  return fixedWalls;
}

// --- FLOOD FILL TO FIND REACHABLE CELLS ---
function findReachableCells(gridWidth, gridHeight, fixedWalls) {
  const reachable = new Set();
  const queue = [];

  // Helper to check if we can move from (x,y) in a direction
  const canMove = (x, y, dir) => {
    const fixed = fixedWalls.get(`${x},${y}`);
    if (fixed && fixed[dir]) return false;
    return true;
  };

  // Start from all edge cells
  for (let x = 0; x < gridWidth; x++) {
    queue.push({ x, y: 0 });
    queue.push({ x, y: gridHeight - 1 });
  }
  for (let y = 0; y < gridHeight; y++) {
    queue.push({ x: 0, y });
    queue.push({ x: gridWidth - 1, y });
  }

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    const key = `${x},${y}`;
    if (reachable.has(key)) continue;
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) continue;

    reachable.add(key);

    // Try moving in each direction
    if (y > 0 && canMove(x, y, 'top') && canMove(x, y - 1, 'bottom')) {
      queue.push({ x, y: y - 1 });
    }
    if (x < gridWidth - 1 && canMove(x, y, 'right') && canMove(x + 1, y, 'left')) {
      queue.push({ x: x + 1, y });
    }
    if (y < gridHeight - 1 && canMove(x, y, 'bottom') && canMove(x, y + 1, 'top')) {
      queue.push({ x, y: y + 1 });
    }
    if (x > 0 && canMove(x, y, 'left') && canMove(x - 1, y, 'right')) {
      queue.push({ x: x - 1, y });
    }
  }

  return reachable;
}

// --- IDENTIFY STROKE CELLS (part of 2-cell-wide corridor connected to outside) ---
function findStrokeCells(reachable, fixedWalls, characters, gridWidth, gridHeight) {
  // Build a set of cells that are within character content areas (excluding padding)
  const contentAreaCells = new Set();
  for (const { x: charX, y: charY } of characters) {
    for (let dy = 1; dy < CHAR_CELL_HEIGHT_UNITS - 1; dy++) {
      for (let dx = 1; dx < CHAR_CELL_WIDTH_UNITS - 1; dx++) {
        contentAreaCells.add(`${charX + dx},${charY + dy}`);
      }
    }
  }

  // Helper to check if a cell has a fixed wall on a given side
  const hasWall = (x, y, dir) => {
    const fixed = fixedWalls.get(`${x},${y}`);
    return fixed && fixed[dir];
  };

  // Helper to check if a vertical corridor exists at (x, y)
  const isVerticalCorridor = (x, y) => {
    return hasWall(x, y, 'left') && hasWall(x + 1, y, 'right');
  };

  // Helper to check if a horizontal corridor exists at (x, y)
  const isHorizontalCorridor = (x, y) => {
    return hasWall(x, y, 'top') && hasWall(x, y + 1, 'bottom');
  };

  // Step 1: Find potential stroke cells (2-cell-wide corridors that extend)
  const potentialStroke = new Set();

  for (const key of reachable) {
    if (!contentAreaCells.has(key)) continue;

    const [x, y] = key.split(',').map(Number);

    // Check for vertical corridor
    if (hasWall(x, y, 'left') && contentAreaCells.has(`${x + 1},${y}`) && hasWall(x + 1, y, 'right')) {
      const extendsUp = isVerticalCorridor(x, y - 1);
      const extendsDown = isVerticalCorridor(x, y + 1);
      const connectsHorizontal = isHorizontalCorridor(x, y) || isHorizontalCorridor(x, y - 1) ||
                                  isHorizontalCorridor(x + 1, y) || isHorizontalCorridor(x + 1, y - 1);
      if (extendsUp || extendsDown || connectsHorizontal) {
        potentialStroke.add(key);
      }
    }

    if (hasWall(x, y, 'right') && contentAreaCells.has(`${x - 1},${y}`) && hasWall(x - 1, y, 'left')) {
      const extendsUp = isVerticalCorridor(x - 1, y - 1);
      const extendsDown = isVerticalCorridor(x - 1, y + 1);
      const connectsHorizontal = isHorizontalCorridor(x - 1, y) || isHorizontalCorridor(x - 1, y - 1) ||
                                  isHorizontalCorridor(x, y) || isHorizontalCorridor(x, y - 1);
      if (extendsUp || extendsDown || connectsHorizontal) {
        potentialStroke.add(key);
      }
    }

    // Check for horizontal corridor
    if (hasWall(x, y, 'top') && contentAreaCells.has(`${x},${y + 1}`) && hasWall(x, y + 1, 'bottom')) {
      const extendsLeft = isHorizontalCorridor(x - 1, y);
      const extendsRight = isHorizontalCorridor(x + 1, y);
      const connectsVertical = isVerticalCorridor(x, y) || isVerticalCorridor(x - 1, y) ||
                                isVerticalCorridor(x, y + 1) || isVerticalCorridor(x - 1, y + 1);
      if (extendsLeft || extendsRight || connectsVertical) {
        potentialStroke.add(key);
      }
    }

    if (hasWall(x, y, 'bottom') && contentAreaCells.has(`${x},${y - 1}`) && hasWall(x, y - 1, 'top')) {
      const extendsLeft = isHorizontalCorridor(x - 1, y - 1);
      const extendsRight = isHorizontalCorridor(x + 1, y - 1);
      const connectsVertical = isVerticalCorridor(x, y - 1) || isVerticalCorridor(x - 1, y - 1) ||
                                isVerticalCorridor(x, y) || isVerticalCorridor(x - 1, y);
      if (extendsLeft || extendsRight || connectsVertical) {
        potentialStroke.add(key);
      }
    }
  }

  // Step 2: Flood fill from padding through non-stroke cells to find "outside" cells
  const canMove = (x, y, dir) => {
    const fixed = fixedWalls.get(`${x},${y}`);
    if (fixed && fixed[dir]) return false;
    return true;
  };

  const outsideCells = new Set();
  const outsideQueue = [];

  // Start from padding cells (non-content area)
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (!contentAreaCells.has(`${x},${y}`)) {
        outsideQueue.push(`${x},${y}`);
      }
    }
  }

  // Flood fill through reachable non-stroke cells
  while (outsideQueue.length > 0) {
    const key = outsideQueue.shift();
    if (outsideCells.has(key)) continue;

    const [x, y] = key.split(',').map(Number);
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) continue;
    if (!reachable.has(key)) continue;
    if (potentialStroke.has(key)) continue; // Don't go through stroke

    outsideCells.add(key);

    const neighbors = [
      { nx: x - 1, ny: y, dir: 'left', revDir: 'right' },
      { nx: x + 1, ny: y, dir: 'right', revDir: 'left' },
      { nx: x, ny: y - 1, dir: 'top', revDir: 'bottom' },
      { nx: x, ny: y + 1, dir: 'bottom', revDir: 'top' },
    ];

    for (const { nx, ny, dir, revDir } of neighbors) {
      const nKey = `${nx},${ny}`;
      if (!outsideCells.has(nKey) && canMove(x, y, dir) && canMove(nx, ny, revDir)) {
        outsideQueue.push(nKey);
      }
    }
  }

  // Find stroke cells adjacent to outside cells
  const connectedStroke = new Set();
  for (const key of potentialStroke) {
    const [x, y] = key.split(',').map(Number);
    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];

    for (const [nx, ny] of neighbors) {
      if (outsideCells.has(`${nx},${ny}`)) {
        connectedStroke.add(key);
        break;
      }
    }
  }

  // Expand: only along corridor direction (vertical corridors expand up/down, horizontal expand left/right)
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of potentialStroke) {
      if (connectedStroke.has(key)) continue;
      const [x, y] = key.split(',').map(Number);

      // Determine this cell's corridor type
      const isInVerticalCorridor = hasWall(x, y, 'left') || hasWall(x, y, 'right');
      const isInHorizontalCorridor = hasWall(x, y, 'top') || hasWall(x, y, 'bottom');

      const neighbors = [
        { nx: x - 1, ny: y, dir: 'left', revDir: 'right', isVerticalMove: false },
        { nx: x + 1, ny: y, dir: 'right', revDir: 'left', isVerticalMove: false },
        { nx: x, ny: y - 1, dir: 'top', revDir: 'bottom', isVerticalMove: true },
        { nx: x, ny: y + 1, dir: 'bottom', revDir: 'top', isVerticalMove: true },
      ];

      for (const { nx, ny, dir, revDir, isVerticalMove } of neighbors) {
        const nKey = `${nx},${ny}`;
        if (!connectedStroke.has(nKey)) continue;
        if (!canMove(x, y, dir) || !canMove(nx, ny, revDir)) continue;

        // Only expand if movement follows corridor direction
        // Vertical corridor: can move up/down; Horizontal corridor: can move left/right
        const followsCorridorDirection =
          (isInVerticalCorridor && isVerticalMove) ||
          (isInHorizontalCorridor && !isVerticalMove);

        // Also check if neighbor is in same type of corridor (for corners)
        const neighborIsVertical = hasWall(nx, ny, 'left') || hasWall(nx, ny, 'right');
        const neighborIsHorizontal = hasWall(nx, ny, 'top') || hasWall(nx, ny, 'bottom');
        const isCornerConnection =
          (isInVerticalCorridor && neighborIsHorizontal) ||
          (isInHorizontalCorridor && neighborIsVertical);

        if (followsCorridorDirection || isCornerConnection) {
          connectedStroke.add(key);
          changed = true;
          break;
        }
      }
    }
  }

  // Step 3: Find enclosed corridor cells (2-cell-wide areas not connected to outside)
  // These should have a center wall
  const enclosedCorridors = new Set();

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const key = `${x},${y}`;
      if (!contentAreaCells.has(key)) continue;
      if (outsideCells.has(key)) continue;
      if (potentialStroke.has(key)) continue;
      if (!reachable.has(key)) continue; // Skip unreachable (holes inside letters)

      // Check if this cell is part of a 2-cell-wide enclosed corridor
      // Vertical: has wall on left, neighbor right has wall on right
      if (hasWall(x, y, 'left') && hasWall(x + 1, y, 'right')) {
        enclosedCorridors.add(key);
        enclosedCorridors.add(`${x + 1},${y}`);
      }
      // Horizontal: has wall on top, neighbor below has wall on bottom
      if (hasWall(x, y, 'top') && hasWall(x, y + 1, 'bottom')) {
        enclosedCorridors.add(key);
        enclosedCorridors.add(`${x},${y + 1}`);
      }
    }
  }

  // Return all for debugging and maze generation
  return { connectedStroke, potentialStroke, enclosedCorridors };
}

// --- HELPER TO GENERATE MAZE ---
function generateMaze(width, height, fixedWalls, strokeCells, enclosedCorridors = new Set()) {
  const grid = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      x, y, visited: false,
      walls: { top: true, right: true, bottom: true, left: true },
    }))
  );

  // Pre-process stroke cells: remove non-fixed walls, mark as visited
  for (const key of strokeCells) {
    const [x, y] = key.split(',').map(Number);
    const cell = grid[y][x];
    const fixed = fixedWalls.get(key) || { top: false, right: false, bottom: false, left: false };

    // Remove walls that aren't fixed (make stroke an open corridor)
    if (!fixed.top) {
      cell.walls.top = false;
      if (y > 0) grid[y - 1][x].walls.bottom = false;
    }
    if (!fixed.right) {
      cell.walls.right = false;
      if (x < width - 1) grid[y][x + 1].walls.left = false;
    }
    if (!fixed.bottom) {
      cell.walls.bottom = false;
      if (y < height - 1) grid[y + 1][x].walls.top = false;
    }
    if (!fixed.left) {
      cell.walls.left = false;
      if (x > 0) grid[y][x - 1].walls.right = false;
    }

    // Mark as visited so maze algorithm skips it
    cell.visited = true;
  }

  // Pre-process enclosed corridors: add center walls (Rule 6)
  // For 2-cell-wide enclosed corridors, keep the wall between the cells
  const hasWall = (x, y, dir) => {
    const fixed = fixedWalls.get(`${x},${y}`);
    return fixed && fixed[dir];
  };

  const processedPairs = new Set();
  for (const key of enclosedCorridors) {
    const [x, y] = key.split(',').map(Number);

    // Check for vertical enclosed corridor (left wall on x, right wall on x+1)
    if (hasWall(x, y, 'left') && hasWall(x + 1, y, 'right')) {
      const pairKey = `v:${x},${y}`;
      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);
        // Keep the wall between x and x+1 (add to fixedWalls-like behavior)
        grid[y][x].walls.right = true;
        if (x + 1 < width) grid[y][x + 1].walls.left = true;
      }
    }

    // Check for horizontal enclosed corridor (top wall on y, bottom wall on y+1)
    if (hasWall(x, y, 'top') && hasWall(x, y + 1, 'bottom')) {
      const pairKey = `h:${x},${y}`;
      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);
        // Keep the wall between y and y+1
        grid[y][x].walls.bottom = true;
        if (y + 1 < height) grid[y + 1][x].walls.top = true;
      }
    }
  }

  // Run maze algorithm for all unvisited cells (handles disconnected regions like holes)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!grid[y][x].visited) {
        recursiveBacktracker(grid, grid[y][x], fixedWalls);
      }
    }
  }

  // Convert grid to wall segments
  const walls = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      if (cell.walls.top) walls.push([x, y, x + 1, y]);
      if (cell.walls.right) walls.push([x + 1, y, x + 1, y + 1]);
      if (cell.walls.bottom) walls.push([x, y + 1, x + 1, y + 1]);
      if (cell.walls.left) walls.push([x, y, x, y + 1]);
    }
  }
  return walls;
}

const SvgGrid = ({ width, height, text, showFrames, wordMazeMode }) => {
  const result = useMemo(() => {
    if (width === 0 || height === 0) return { mazeWalls: [], characters: [], strokeCellsArray: [], potentialStrokeArray: [], wordMazeData: null };

    const gridWidthUnits = Math.floor(width / UNIT_SIZE);
    const gridHeightUnits = Math.floor(height / UNIT_SIZE);

    // --- Word Maze Mode ---
    if (wordMazeMode) {
      const wmResult = generateWordMaze(text, gridWidthUnits, gridHeightUnits, fontData);
      const strokeCellsArray = Array.from(wmResult.strokeCells || []).map(key => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      });
      return {
        mazeWalls: wmResult.walls,
        characters: wmResult.characters,
        strokeCellsArray,
        potentialStrokeArray: [],
        wordMazeData: wmResult,
      };
    }

    // --- Classic Mode ---
    const charsPerGridRow = Math.floor(gridWidthUnits / CHAR_CELL_WIDTH_UNITS);

    const characters = text.split('').map((char, index) => {
      const charCol = index % charsPerGridRow;
      const charRow = Math.floor(index / charsPerGridRow);
      const x = charCol * CHAR_CELL_WIDTH_UNITS;
      const y = charRow * CHAR_CELL_HEIGHT_UNITS;

      if ((x + CHAR_CELL_WIDTH_UNITS) > gridWidthUnits || (y + CHAR_CELL_HEIGHT_UNITS) > gridHeightUnits) {
        return null;
      }

      return { char, x, y };
    }).filter(Boolean);

    // Convert font walls to fixed walls for maze generation
    const fixedWalls = fontWallsToFixedWalls(characters, gridWidthUnits, gridHeightUnits);

    // Find reachable cells (from grid edges) and stroke cells (connected to outside)
    const reachable = findReachableCells(gridWidthUnits, gridHeightUnits, fixedWalls);
    const { connectedStroke, potentialStroke, enclosedCorridors } = findStrokeCells(reachable, fixedWalls, characters, gridWidthUnits, gridHeightUnits);

    const mazeWalls = generateMaze(gridWidthUnits, gridHeightUnits, fixedWalls, connectedStroke, enclosedCorridors);

    // Debug: convert to arrays for visualization
    const strokeCellsArray = Array.from(connectedStroke).map(key => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
    const potentialStrokeArray = Array.from(potentialStroke).map(key => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });

    return { mazeWalls, characters, strokeCellsArray, potentialStrokeArray, wordMazeData: null };

  }, [width, height, text, wordMazeMode]);

  const { mazeWalls, characters, strokeCellsArray, potentialStrokeArray, wordMazeData } = result;

  return (
    <svg width={width} height={height} style={{ position: 'relative', zIndex: 1 }}>
      {/* 1. Render the background maze */}
      {mazeWalls.map(([x1, y1, x2, y2], i) => (
        <line
          key={`maze-${i}`}
          x1={x1 * UNIT_SIZE} y1={y1 * UNIT_SIZE}
          x2={x2 * UNIT_SIZE} y2={y2 * UNIT_SIZE}
          stroke="#adb5bd" strokeWidth="2" strokeLinecap="square"
        />
      ))}

      {/* 2. Debug: show stroke cells */}
      {showFrames && potentialStrokeArray.map(({ x, y }, i) => (
        <rect
          key={`potential-${i}`}
          x={x * UNIT_SIZE}
          y={y * UNIT_SIZE}
          width={UNIT_SIZE}
          height={UNIT_SIZE}
          fill="rgba(255, 255, 0, 0.3)"
        />
      ))}
      {showFrames && strokeCellsArray.map(({ x, y }, i) => (
        <rect
          key={`stroke-${i}`}
          x={x * UNIT_SIZE}
          y={y * UNIT_SIZE}
          width={UNIT_SIZE}
          height={UNIT_SIZE}
          fill="rgba(255, 0, 0, 0.4)"
        />
      ))}

      {/* 3. Word maze: render start/end markers and entry/exit points */}
      {wordMazeData && wordMazeData.startCell && (
        <rect
          x={wordMazeData.startCell.x * UNIT_SIZE + 2}
          y={wordMazeData.startCell.y * UNIT_SIZE + 2}
          width={UNIT_SIZE - 4}
          height={UNIT_SIZE - 4}
          fill="rgba(0, 180, 0, 0.6)"
          rx="2"
        />
      )}
      {wordMazeData && wordMazeData.endCell && (
        <rect
          x={wordMazeData.endCell.x * UNIT_SIZE + 2}
          y={wordMazeData.endCell.y * UNIT_SIZE + 2}
          width={UNIT_SIZE - 4}
          height={UNIT_SIZE - 4}
          fill="rgba(220, 0, 0, 0.6)"
          rx="2"
        />
      )}

      {/* 4. Word maze debug: show entry/exit pairs */}
      {showFrames && wordMazeData && wordMazeData.entryExitPairs && wordMazeData.entryExitPairs.map((pair, i) => {
        if (!pair) return null;
        return (
          <g key={`ee-${i}`}>
            <rect
              x={pair.entry.x * UNIT_SIZE + 1} y={pair.entry.y * UNIT_SIZE + 1}
              width={UNIT_SIZE - 2} height={UNIT_SIZE - 2}
              fill="rgba(0, 100, 255, 0.4)" stroke="blue" strokeWidth="1"
            />
            <rect
              x={pair.exit.x * UNIT_SIZE + 1} y={pair.exit.y * UNIT_SIZE + 1}
              width={UNIT_SIZE - 2} height={UNIT_SIZE - 2}
              fill="rgba(255, 100, 0, 0.4)" stroke="orange" strokeWidth="1"
            />
          </g>
        );
      })}

      {/* 5. Render character debug frames and walls (debug mode) */}
      {showFrames && characters.map(({ char, x, y }, index) => {
        const charData = fontData[char.toUpperCase()];
        const xPos = x * UNIT_SIZE;
        const yPos = y * UNIT_SIZE;

        return (
          <g key={index} transform={`translate(${xPos}, ${yPos})`}>
            <rect x="0" y="0" width={CHAR_CELL_WIDTH_UNITS * UNIT_SIZE} height={CHAR_CELL_HEIGHT_UNITS * UNIT_SIZE} fill="rgba(68, 114, 196, 0.1)" />
            {charData && charData.map((wall, i) => {
              const [x1, y1, x2, y2] = wall;
              return (
                <line
                  key={i}
                  x1={(x1 - 1 + CHAR_PADDING_UNITS) * UNIT_SIZE}
                  y1={(y1 - 1 + CHAR_PADDING_UNITS) * UNIT_SIZE}
                  x2={(x2 - 1 + CHAR_PADDING_UNITS) * UNIT_SIZE}
                  y2={(y2 - 1 + CHAR_PADDING_UNITS) * UNIT_SIZE}
                  stroke="#0d1b2a" strokeWidth="2" strokeLinecap="square"
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  );
};

export default SvgGrid;
