import React, { useMemo } from 'react';
import fontData from '../assets/maze-font.json';
import { generateWordMaze } from '../lib/wordMazeGenerator';

// --- CONSTANTS ---
const BASE_UNIT_SIZE = 17;
const MIN_UNIT_SIZE = 8;
const MAX_UNIT_SIZE = 20;
const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 14;
const CHAR_PADDING_UNITS = 1;
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

const SvgGrid = ({ width, height, text, showPath }) => {
  const result = useMemo(() => {
    if (width === 0 || height === 0) return {
      glyphWalls: new Map(),
      backgroundWalls: [],
      characters: [],
      solutionPath: [],
      unitSize: BASE_UNIT_SIZE,
      offsetX: 0,
      offsetY: 0,
    };

    // Calculate optimal unit size for the full area
    const unitSize = calculateOptimalUnitSize(text, width, height);

    const gridWidthUnits = Math.floor(width / unitSize);
    const gridHeightUnits = Math.floor(height / unitSize);

    const wmResult = generateWordMaze(text, gridWidthUnits, gridHeightUnits, fontData);

    // Build a set of glyph walls (walls that come from fontData)
    const glyphWalls = new Map(); // Map<charIndex, walls[]>

    wmResult.characters.forEach((charInfo, index) => {
      const charData = fontData[charInfo.char.toUpperCase()];
      if (!charData) {
        glyphWalls.set(index, []);
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
      glyphWalls.set(index, walls);
    });

    // Create a set of glyph wall strings for fast lookup
    const glyphWallSet = new Set();
    for (const walls of glyphWalls.values()) {
      for (const wall of walls) {
        glyphWallSet.add(wall.join(','));
      }
    }

    // Separate background walls (all walls that aren't glyph walls)
    const backgroundWalls = wmResult.walls.filter(wall =>
      !glyphWallSet.has(wall.join(','))
    );

    return {
      glyphWalls,
      backgroundWalls,
      characters: wmResult.characters,
      solutionPath: wmResult.solutionPath || [],
      unitSize,
    };
  }, [width, height, text]);

  const { glyphWalls, backgroundWalls, characters, solutionPath, unitSize } = result;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Render background walls (subtle gray) */}
      {backgroundWalls.map(([x1, y1, x2, y2], i) => (
        <line
          key={`bg-${i}`}
          x1={x1 * unitSize} y1={y1 * unitSize}
          x2={x2 * unitSize} y2={y2 * unitSize}
          stroke="#adb5bd"
          strokeWidth="2"
          strokeLinecap="square"
        />
      ))}

      {/* Render glyph walls (bold, colorful) */}
      {Array.from(glyphWalls.entries()).map(([charIndex, walls]) => {
        const color = LETTER_COLORS[charIndex % LETTER_COLORS.length];
        return walls.map(([x1, y1, x2, y2], i) => (
          <line
            key={`glyph-${charIndex}-${i}`}
            x1={x1 * unitSize} y1={y1 * unitSize}
            x2={x2 * unitSize} y2={y2 * unitSize}
            stroke={color}
            strokeWidth={Math.max(3, unitSize * 0.25)}
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
};

export default SvgGrid;
