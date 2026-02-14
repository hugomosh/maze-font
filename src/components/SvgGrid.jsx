import React, { useMemo } from 'react';
import fontData from '../assets/maze-font.json';
import { generateWordMaze } from '../lib/wordMazeGenerator';

// --- CONSTANTS ---
const UNIT_SIZE = 17;
const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 14;
const CHAR_PADDING_UNITS = 1;

export const CHAR_CELL_WIDTH_UNITS = CHAR_CONTENT_WIDTH + CHAR_PADDING_UNITS * 2;
export const CHAR_CELL_HEIGHT_UNITS = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2;
export const UNIT_SIZE_EXPORT = UNIT_SIZE;

const SvgGrid = ({ width, height, text }) => {
  const result = useMemo(() => {
    if (width === 0 || height === 0) return { mazeWalls: [], characters: [] };

    const gridWidthUnits = Math.floor(width / UNIT_SIZE);
    const gridHeightUnits = Math.floor(height / UNIT_SIZE);

    const wmResult = generateWordMaze(text, gridWidthUnits, gridHeightUnits, fontData);
    return {
      mazeWalls: wmResult.walls,
      characters: wmResult.characters,
    };
  }, [width, height, text]);

  const { mazeWalls, characters } = result;

  return (
    <svg width={width} height={height} style={{ position: 'relative', zIndex: 1 }}>
      {mazeWalls.map(([x1, y1, x2, y2], i) => (
        <line
          key={`maze-${i}`}
          x1={x1 * UNIT_SIZE} y1={y1 * UNIT_SIZE}
          x2={x2 * UNIT_SIZE} y2={y2 * UNIT_SIZE}
          stroke="#adb5bd" strokeWidth="2" strokeLinecap="square"
        />
      ))}
    </svg>
  );
};

export default SvgGrid;
