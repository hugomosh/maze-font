import React, { useMemo } from 'react';
import fontData from '../assets/maze-font.json';
import { generateWordMaze } from '../lib/wordMazeGenerator';

// --- CONSTANTS ---
const BASE_UNIT_SIZE = 17;
const MIN_UNIT_SIZE = 8;
const MAX_UNIT_SIZE = 20;
const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 14;
const CHAR_PADDING_UNITS = 2;
const CONTAINER_PADDING = 0.1; // 10% padding on each side

// Color palettes
const LETTER_COLORS = [
  '#ff6b6b', // Red
  '#4ecdc4', // Teal
  '#45b7d1', // Blue
  '#f9ca24', // Yellow
  '#6c5ce7', // Purple
  '#a29bfe', // Light purple
  '#fd79a8', // Pink
  '#fdcb6e', // Orange
  '#55efc4', // Mint
  '#74b9ff', // Sky blue
];

const BACKGROUND_COLORS = [
  '#e8e8e8', // Light gray
  '#d4d4d4', // Medium gray
  '#c0c0c0', // Gray
];

export const CHAR_CELL_WIDTH_UNITS = CHAR_CONTENT_WIDTH + CHAR_PADDING_UNITS * 2;
export const CHAR_CELL_HEIGHT_UNITS = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2;
export const UNIT_SIZE_EXPORT = BASE_UNIT_SIZE;

// Calculate optimal unit size to fit text in available space
// Strategy: Use 2-3 characters per row to maximize size and fill the space
function calculateOptimalUnitSize(text, width, height) {
  if (!text || width === 0 || height === 0) return BASE_UNIT_SIZE;

  const textLength = text.length;
  if (textLength === 0) return BASE_UNIT_SIZE;

  const charCellWidthUnits = CHAR_CELL_WIDTH_UNITS;
  const charCellHeightUnits = CHAR_CELL_HEIGHT_UNITS;

  // Try different chars per row (2-3 preferred for maximum size)
  const candidates = [];

  for (let charsPerRow = 2; charsPerRow <= Math.max(3, textLength); charsPerRow++) {
    const numRows = Math.ceil(textLength / charsPerRow);

    // Calculate unit size based on width constraint
    const widthUnits = charsPerRow * charCellWidthUnits;
    const unitSizeFromWidth = Math.floor(width / widthUnits);

    // Calculate unit size based on height constraint
    const heightUnits = numRows * charCellHeightUnits;
    const unitSizeFromHeight = Math.floor(height / heightUnits);

    // Use the smaller of the two (must fit in both dimensions)
    const unitSize = Math.min(unitSizeFromWidth, unitSizeFromHeight);

    if (unitSize >= MIN_UNIT_SIZE && unitSize <= MAX_UNIT_SIZE) {
      candidates.push({ charsPerRow, unitSize, numRows });
    }
  }

  // Pick the layout that best fills the space (prioritize using more vertical space)
  if (candidates.length > 0) {
    // Sort by: 1) unit size (larger is better), 2) fewer chars per row (more rows = better vertical fill)
    candidates.sort((a, b) => {
      if (b.unitSize !== a.unitSize) return b.unitSize - a.unitSize;
      return a.charsPerRow - b.charsPerRow; // Fewer chars per row = more rows
    });
    return candidates[0].unitSize;
  }

  // Fallback: use minimum size
  return MIN_UNIT_SIZE;
}

const SvgGrid = React.forwardRef(({ width, height, text, showPath, sizingMode = 'autofit' }, ref) => {
  const result = useMemo(() => {
    if (width === 0 || height === 0) return {
      glyphWalls: new Map(),
      mazeWalls: [],
      characters: [],
      solutionPath: [],
      unitSize: BASE_UNIT_SIZE,
      cellConfig: null,
    };

    // Start with a base unit size to get grid dimensions
    const initialUnitSize = MIN_UNIT_SIZE;
    const gridWidthUnits = Math.floor(width / initialUnitSize);
    const gridHeightUnits = Math.floor(height / initialUnitSize);

    const wmResult = generateWordMaze(text, gridWidthUnits, gridHeightUnits, fontData, null, sizingMode);

    // Calculate actual unit size based on the grid dimensions
    // We want to fit the grid snugly in the available space
    const unitSizeFromWidth = width / gridWidthUnits;
    const unitSizeFromHeight = height / gridHeightUnits;
    const unitSize = Math.min(unitSizeFromWidth, unitSizeFromHeight);

    // Step 1: Build potential glyph walls from fontData
    const potentialGlyphWalls = new Map(); // Map<charIndex, walls[]>

    wmResult.characters.forEach((charInfo, index) => {
      const charData = fontData[charInfo.char.toUpperCase()];
      if (!charData) {
        potentialGlyphWalls.set(index, []);
        return;
      }

      const walls = [];
      for (const [x1, y1, x2, y2] of charData) {
        // Convert font coordinates to grid coordinates
        const gx1 = charInfo.x + x1;
        const gy1 = charInfo.y + y1;
        const gx2 = charInfo.x + x2;
        const gy2 = charInfo.y + y2;

        if (gx1 === gx2) {
          // Vertical wall segment
          const gx = gx1;
          const minY = Math.min(gy1, gy2);
          const maxY = Math.max(gy1, gy2);
          for (let gy = minY; gy < maxY; gy++) {
            walls.push([gx, gy, gx, gy + 1]);
          }
        } else if (gy1 === gy2) {
          // Horizontal wall segment
          const gy = gy1;
          const minX = Math.min(gx1, gx2);
          const maxX = Math.max(gx1, gx2);
          for (let gx = minX; gx < maxX; gx++) {
            walls.push([gx, gy, gx + 1, gy]);
          }
        }
      }
      potentialGlyphWalls.set(index, walls);
    });

    // Step 2: Create a Set of all walls in final output
    const finalWallSet = new Set(wmResult.walls.map(w => w.join(',')));

    // Step 3: Filter glyph walls to only those that exist in final output
    const glyphWalls = new Map();
    for (const [charIndex, walls] of potentialGlyphWalls.entries()) {
      const existingWalls = walls.filter(wall => finalWallSet.has(wall.join(',')));
      glyphWalls.set(charIndex, existingWalls);
    }

    // Step 4: Create glyph wall set for filtering maze walls
    const glyphWallSet = new Set();
    for (const walls of glyphWalls.values()) {
      for (const wall of walls) {
        glyphWallSet.add(wall.join(','));
      }
    }

    // Step 5: All non-glyph walls go to maze (gray)
    const mazeWalls = wmResult.walls.filter(wall => !glyphWallSet.has(wall.join(',')));

    return {
      glyphWalls,
      mazeWalls,
      characters: wmResult.characters,
      solutionPath: wmResult.solutionPath || [],
      unitSize,
      cellConfig: wmResult.cellConfig,
    };
  }, [width, height, text, sizingMode]);

  const { glyphWalls, mazeWalls, characters, solutionPath, unitSize, cellConfig } = result;

  return (
    <svg ref={ref} width={width} height={height} style={{ display: 'block' }}>
      {/* Background fill */}
      <rect width={width} height={height} fill="#f5f5f5" />

      {/* Render maze walls (everything except glyphs, varied grays) */}
      {mazeWalls.map(([x1, y1, x2, y2], i) => (
        <line
          key={`maze-${i}`}
          x1={x1 * unitSize} y1={y1 * unitSize}
          x2={x2 * unitSize} y2={y2 * unitSize}
          stroke={BACKGROUND_COLORS[i % BACKGROUND_COLORS.length]}
          strokeWidth={Math.max(3, unitSize * 0.25)}
          strokeLinecap="square"
        />
      ))}

      {/* Render filtered glyph walls (letter shapes only, excluding removed entry/exit) */}
      {Array.from(glyphWalls.entries()).map(([charIndex, walls]) => {
        const color = LETTER_COLORS[charIndex % LETTER_COLORS.length];
        return walls.map(([x1, y1, x2, y2], i) => (
          <line
            key={`glyph-${charIndex}-${i}`}
            x1={x1 * unitSize} y1={y1 * unitSize}
            x2={x2 * unitSize} y2={y2 * unitSize}
            stroke={color}
            strokeWidth={Math.max(4, unitSize * 0.3)}
            strokeLinecap="round"
          />
        ));
      })}

      {/* Render solution path as a continuous line */}
      {showPath && solutionPath.length > 1 && (
        <polyline
          points={solutionPath.map(({ x, y }) =>
            `${(x + 0.5) * unitSize},${(y + 0.5) * unitSize}`
          ).join(' ')}
          fill="none"
          stroke="#ff6b6b"
          strokeWidth={Math.max(2, unitSize * 0.15)}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
      )}

      {/* Render start and end markers */}
      {showPath && solutionPath.length > 0 && (
        <>
          {/* Start marker (green) */}
          <circle
            cx={(solutionPath[0].x + 0.5) * unitSize}
            cy={(solutionPath[0].y + 0.5) * unitSize}
            r={unitSize * 0.3}
            fill="#51cf66"
            stroke="#2b8a3e"
            strokeWidth="2"
          />
          {/* End marker (red) */}
          <circle
            cx={(solutionPath[solutionPath.length - 1].x + 0.5) * unitSize}
            cy={(solutionPath[solutionPath.length - 1].y + 0.5) * unitSize}
            r={unitSize * 0.3}
            fill="#ff6b6b"
            stroke="#c92a2a"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
});

SvgGrid.displayName = 'SvgGrid';

export default SvgGrid;
