import React, { useMemo } from 'react';
import fontData from '../assets/maze-font.json';
import { recursiveBacktracker } from '../lib/mazeGenerator';

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

// --- HELPER TO GENERATE MAZE ---
function generateMaze(width, height, fixedWalls) {
  const grid = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      x, y, visited: false,
      walls: { top: true, right: true, bottom: true, left: true },
    }))
  );

  const startCell = grid[0]?.[0] || null;
  if (!startCell) return [];

  const mazeGrid = recursiveBacktracker(grid, startCell, fixedWalls);

  const walls = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = mazeGrid[y][x];
      if (cell.walls.top) walls.push([x, y, x + 1, y]);
      if (cell.walls.right) walls.push([x + 1, y, x + 1, y + 1]);
      if (cell.walls.bottom) walls.push([x, y + 1, x + 1, y + 1]);
      if (cell.walls.left) walls.push([x, y, x, y + 1]);
    }
  }
  return walls;
}


// --- CONSTANTS ---
const UNIT_SIZE = 17;
const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 12;
const CHAR_PADDING_UNITS = 1;

export const CHAR_CELL_WIDTH_UNITS = CHAR_CONTENT_WIDTH + CHAR_PADDING_UNITS * 2;
export const CHAR_CELL_HEIGHT_UNITS = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2;
export const UNIT_SIZE_EXPORT = UNIT_SIZE;

const SvgGrid = ({ width, height, text, showFrames }) => {
  const { mazeWalls, characters } = useMemo(() => {
    if (width === 0 || height === 0) return { mazeWalls: [], characters: [] };

    const gridWidthUnits = Math.floor(width / UNIT_SIZE);
    const gridHeightUnits = Math.floor(height / UNIT_SIZE);
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
    const mazeWalls = generateMaze(gridWidthUnits, gridHeightUnits, fixedWalls);
    return { mazeWalls, characters };

  }, [width, height, text]);

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

      {/* 2. Render the characters and their walls on top */}
      {characters.map(({ char, x, y }, index) => {
        const charData = fontData[char.toUpperCase()];
        const xPos = x * UNIT_SIZE;
        const yPos = y * UNIT_SIZE;

        return (
          <g key={index} transform={`translate(${xPos}, ${yPos})`}>
            {showFrames &&
              <rect x="0" y="0" width={CHAR_CELL_WIDTH_UNITS * UNIT_SIZE} height={CHAR_CELL_HEIGHT_UNITS * UNIT_SIZE} fill="rgba(68, 114, 196, 0.1)" />
            }
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
