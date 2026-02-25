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

const LETTER_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7',
  '#a29bfe', '#fd79a8', '#fdcb6e', '#55efc4', '#74b9ff',
];

const THEMES = {
  classic: { bg: '#f5f5f5', maze: '#d4d4d4', glyph: null },
  dark:    { bg: '#1a1a2e', maze: '#2d3561', glyph: null },
  mono:    { bg: '#ffffff', maze: '#e0e0e0', glyph: '#2c3e50' },
  ink:     { bg: '#ffffff', maze: '#aaaaaa', glyph: '#000000' },
};

// Position factor maps: [horizontal, vertical] in 0..1
const POS_H = { 'top-left': 0, 'left': 0, 'bottom-left': 0, 'top': 0.5, 'center': 0.5, 'bottom': 0.5, 'top-right': 1, 'right': 1, 'bottom-right': 1 };
const POS_V = { 'top-left': 0, 'top': 0, 'top-right': 0, 'left': 0.5, 'center': 0.5, 'right': 0.5, 'bottom-left': 1, 'bottom': 1, 'bottom-right': 1 };

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

const SvgGrid = React.forwardRef(({ width, height, text, showPath, sizingMode = 'autofit', verticalBias = 1, position = 'center', theme = 'classic' }, ref) => {
  const result = useMemo(() => {
    if (width === 0 || height === 0) return {
      glyphWalls: new Map(),
      mazeWalls: [],
      characters: [],
      solutionPath: [],
      unitSize: BASE_UNIT_SIZE,
      cellConfig: null,
      actualMazeWidthUnits: 0,
      actualMazeHeightUnits: 0,
    };

    // Calculate grid dimensions based on mode
    let gridWidthUnits, gridHeightUnits;

    if (sizingMode === 'compact') {
      // Compact mode: calculate exact dimensions needed for text
      // Each word on a new line, minimal padding
      const words = text.split(' ').filter(w => w.length > 0);
      const longestWordLength = Math.max(...words.map(w => w.length), 1);
      const numWords = words.length;

      // Calculate grid size: longest word + padding on sides, word count + padding top/bottom
      const SIDE_PADDING = CHAR_CELL_WIDTH_UNITS * 2; // 2 cells padding on each side
      const VERTICAL_PADDING = CHAR_CELL_HEIGHT_UNITS * 2; // 2 cells padding top/bottom

      gridWidthUnits = (longestWordLength * CHAR_CELL_WIDTH_UNITS) + SIDE_PADDING;
      gridHeightUnits = (numWords * CHAR_CELL_HEIGHT_UNITS) + VERTICAL_PADDING;
    } else {
      // Standard/Autofit modes: use reference size for consistent resolution across devices
      const referenceSize = 800;
      const targetUnitSize = 10;

      const baseGridWidth = Math.floor(referenceSize / targetUnitSize);
      const baseGridHeight = Math.floor(referenceSize / targetUnitSize);

      // Adjust grid dimensions based on aspect ratio
      const aspectRatio = width / height;

      if (aspectRatio > 1) {
        // Wider than tall
        gridWidthUnits = Math.floor(baseGridWidth * aspectRatio);
        gridHeightUnits = baseGridHeight;
      } else {
        // Taller than wide
        gridWidthUnits = baseGridWidth;
        gridHeightUnits = Math.floor(baseGridHeight / aspectRatio);
      }
    }

    const wmResult = generateWordMaze(text, gridWidthUnits, gridHeightUnits, fontData, null, sizingMode, verticalBias);

    // Calculate actual maze dimensions (compact mode may use less width)
    let actualMazeWidthUnits = gridWidthUnits;
    let actualMazeHeightUnits = gridHeightUnits;

    if (wmResult.walls.length > 0) {
      const maxX = Math.max(...wmResult.walls.map(([x1, , x2]) => Math.max(x1, x2)));
      const maxY = Math.max(...wmResult.walls.map(([, y1, , y2]) => Math.max(y1, y2)));
      actualMazeWidthUnits = maxX;
      actualMazeHeightUnits = maxY;
    }

    // Calculate unit size to fit the actual maze in available space
    const unitSizeFromWidth = width / actualMazeWidthUnits;
    const unitSizeFromHeight = height / actualMazeHeightUnits;
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
      actualMazeWidthUnits,
      actualMazeHeightUnits,
    };
  }, [width, height, text, sizingMode, verticalBias]);

  const { glyphWalls, mazeWalls, characters, solutionPath, unitSize, cellConfig, actualMazeWidthUnits, actualMazeHeightUnits } = result;

  const svgWidth = width;
  const svgHeight = height;

  const mazeWidth = actualMazeWidthUnits * unitSize;
  const mazeHeight = actualMazeHeightUnits * unitSize;
  const freeX = Math.max(0, svgWidth - mazeWidth);
  const freeY = Math.max(0, svgHeight - mazeHeight);
  const offsetX = freeX * (POS_H[position] ?? 0.5);
  const offsetY = freeY * (POS_V[position] ?? 0.5);

  const th = THEMES[theme] || THEMES.classic;

  return (
    <svg ref={ref} width={svgWidth} height={svgHeight} style={{ display: 'block' }}>
      <rect width={svgWidth} height={svgHeight} fill={th.bg} />

      {/* Group for centered maze content */}
      <g transform={`translate(${offsetX}, ${offsetY})`}>

      {mazeWalls.map(([x1, y1, x2, y2], i) => (
        <line
          key={`maze-${i}`}
          x1={x1 * unitSize} y1={y1 * unitSize}
          x2={x2 * unitSize} y2={y2 * unitSize}
          stroke={th.maze}
          strokeWidth={unitSize * 0.25}
          strokeLinecap="square"
        />
      ))}

      {Array.from(glyphWalls.entries()).map(([charIndex, walls]) => {
        const color = th.glyph !== null
          ? th.glyph
          : LETTER_COLORS[charIndex % LETTER_COLORS.length];
        return walls.map(([x1, y1, x2, y2], i) => (
          <line
            key={`glyph-${charIndex}-${i}`}
            x1={x1 * unitSize} y1={y1 * unitSize}
            x2={x2 * unitSize} y2={y2 * unitSize}
            stroke={color}
            strokeWidth={unitSize * 0.3}
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
          strokeWidth={unitSize * 0.15}
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
            strokeWidth={unitSize * 0.1}
          />
          {/* End marker (red) */}
          <circle
            cx={(solutionPath[solutionPath.length - 1].x + 0.5) * unitSize}
            cy={(solutionPath[solutionPath.length - 1].y + 0.5) * unitSize}
            r={unitSize * 0.3}
            fill="#ff6b6b"
            stroke="#c92a2a"
            strokeWidth={unitSize * 0.1}
          />
        </>
      )}
      </g>
    </svg>
  );
});

SvgGrid.displayName = 'SvgGrid';

export default SvgGrid;
