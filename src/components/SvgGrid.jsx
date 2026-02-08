import React, { useMemo } from 'react';
import fontData from '../assets/maze-font.json';
import { generateMaze } from '../lib/mazeGenerator';

const UNIT_SIZE = 17; // px - size of one grid square
const CHAR_CONTENT_WIDTH = 8; // units - width of the actual maze char inside its cell
const CHAR_CONTENT_HEIGHT = 12; // units - height of the actual maze char inside its cell
const CHAR_PADDING_UNITS = 1; // units - padding around the char content within its cell

export const CHAR_CELL_WIDTH_UNITS = CHAR_CONTENT_WIDTH + CHAR_PADDING_UNITS * 2;
export const CHAR_CELL_HEIGHT_UNITS = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2;
export const UNIT_SIZE_EXPORT = UNIT_SIZE; // Export for use in MazeGenerator

const SvgGrid = ({ width, height, text, showFrames }) => {
  const { gridWidthUnits, gridHeightUnits, mazeWalls, blockedCells } = useMemo(() => {
    if (width === 0 || height === 0) {
      return { mazeWalls: [], blockedCells: new Set() };
    }

    const gridWidthUnits = Math.floor(width / UNIT_SIZE);
    const gridHeightUnits = Math.floor(height / UNIT_SIZE);
    
    // Determine which cells are blocked by characters
    const blockedCells = new Set();
    const charCellWidthPx = CHAR_CELL_WIDTH_UNITS * UNIT_SIZE;
    const charCellHeightPx = CHAR_CELL_HEIGHT_UNITS * UNIT_SIZE;
    const charsPerGridRow = Math.floor(width / charCellWidthPx);

    text.split('').forEach((char, index) => {
      const col = index % charsPerGridRow;
      const row = Math.floor(index / charsPerGridRow);
      const xStart = col * CHAR_CELL_WIDTH_UNITS;
      const yStart = row * CHAR_CELL_HEIGHT_UNITS;
      
      if ((xStart + CHAR_CELL_WIDTH_UNITS) > gridWidthUnits || (yStart + CHAR_CELL_HEIGHT_UNITS) > gridHeightUnits) {
        return;
      }

      for (let y = 0; y < CHAR_CELL_HEIGHT_UNITS; y++) {
        for (let x = 0; x < CHAR_CELL_WIDTH_UNITS; x++) {
          blockedCells.add(`${xStart + x},${yStart + y}`);
        }
      }
    });
    
    const mazeWalls = generateMaze(gridWidthUnits, gridHeightUnits, blockedCells);
    
    return { gridWidthUnits, gridHeightUnits, mazeWalls, blockedCells };

  }, [width, height, text]);

  if (width === 0 || height === 0) {
    return null; // Don't render anything if we don't have a size yet
  }

  const charCellWidthPx = CHAR_CELL_WIDTH_UNITS * UNIT_SIZE;
  const charCellHeightPx = CHAR_CELL_HEIGHT_UNITS * UNIT_SIZE;
  const charsPerGridRow = Math.floor(width / charCellWidthPx);

  return (
    <svg width={width} height={height} style={{ position: 'relative', zIndex: 1 }}>
      {/* Background Grid Lines (Optional but good for visual debugging) */}
      {Array.from({ length: gridHeightUnits }).map((_, i) => (
        <line key={`h-${i}`} x1="0" y1={i * UNIT_SIZE} x2={width} y2={i * UNIT_SIZE} stroke="#e9ecef" strokeWidth="1"/>
      ))}
      {Array.from({ length: gridWidthUnits }).map((_, i) => (
        <line key={`v-${i}`} x1={i * UNIT_SIZE} y1="0" x2={i * UNIT_SIZE} y2={height} stroke="#e9ecef" strokeWidth="1"/>
      ))}

      {/* Render Generated Maze Walls */}
      {mazeWalls.map((wall, wallIndex) => {
        const [x1, y1, x2, y2] = wall;
        return (
          <line
            key={`maze-${wallIndex}`}
            x1={x1 * UNIT_SIZE} y1={y1 * UNIT_SIZE}
            x2={x2 * UNIT_SIZE} y2={y2 * UNIT_SIZE}
            stroke="#adb5bd" strokeWidth="2" strokeLinecap="square"
          />
        );
      })}

      {/* Character Cells and Font Walls */}
      {text.split('').map((char, index) => {
        const col = index % charsPerGridRow;
        const row = Math.floor(index / charsPerGridRow);
        const xPos = col * charCellWidthPx;
        const yPos = row * charCellHeightPx;

        if (xPos + charCellWidthPx > width || yPos + charCellHeightPx > height) return null;

        const charDefinition = fontData[char.toUpperCase()];

        return (
          <g key={index} transform={`translate(${xPos}, ${yPos})`}>
            {showFrames && (
              <rect x={0} y={0} width={charCellWidthPx} height={charCellHeightPx} fill="rgba(68, 114, 196, 0.05)" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
            )}
                        {charDefinition && charDefinition.map((wall, wallIndex) => {
                          const [x1, y1, x2, y2] = wall;
                          return (
                            <line
                              key={wallIndex}
                              x1={(CHAR_PADDING_UNITS + x1 - 1) * UNIT_SIZE}
                              y1={(CHAR_PADDING_UNITS + y1 - 1) * UNIT_SIZE}
                              x2={(CHAR_PADDING_UNITS + x2 - 1) * UNIT_SIZE}
                              y2={(CHAR_PADDING_UNITS + y2 - 1) * UNIT_SIZE}
                              stroke="#0d1b2a"
                              strokeWidth="2"
                              strokeLinecap="square"
                            />
                          );
                        })}
          </g>
        );
      })}
    </svg>
  );
};

export default SvgGrid;
