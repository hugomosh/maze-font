import React from 'react';
import fontData from '../assets/maze-font.json';

// Font vertex coordinate space per character: 10 units wide × 14 units tall.
// Each [x1,y1,x2,y2] segment is a wall edge between vertices in that space.
const CELL_W = 10;
const CELL_H = 14;

const LETTER_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7',
  '#a29bfe', '#fd79a8', '#fdcb6e', '#55efc4', '#74b9ff',
];

// Render one or more characters as maze-font SVG strokes.
// Props:
//   text       — string to render (spaces are rendered as gaps)
//   height     — rendered pixel height (width scales proportionally)
//   color      — single stroke color; if null uses LETTER_COLORS per char
//   strokeWidth — SVG stroke-width in coordinate-space units (default 0.85)
//   gap        — space in units between characters (default 1)
export function MazeGlyph({ text = '', height = 40, color = null, strokeWidth = 0.85, gap = 1 }) {
  if (!text) return null;
  const chars = text.toUpperCase().split('');

  // Build a list of {char, isSpace} items
  const items = chars.map(ch => ({ char: ch, isSpace: ch === ' ' }));
  const totalWidth = items.reduce((acc, { isSpace }, i) => {
    return acc + (isSpace ? CELL_W * 0.6 : CELL_W) + (i < items.length - 1 ? gap : 0);
  }, 0);

  let offsetX = 0;
  const segments = [];
  items.forEach(({ char, isSpace }, i) => {
    const charWidth = isSpace ? CELL_W * 0.6 : CELL_W;
    if (!isSpace) {
      const segs = fontData[char] || [];
      const stroke = color || LETTER_COLORS[segments.length % LETTER_COLORS.length];
      segs.forEach(([x1, y1, x2, y2], j) => {
        segments.push(
          <line
            key={`${i}-${j}`}
            x1={offsetX + x1} y1={y1}
            x2={offsetX + x2} y2={y2}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      });
    }
    offsetX += charWidth + (i < items.length - 1 ? gap : 0);
  });

  const pixelWidth = (height / CELL_H) * totalWidth;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${CELL_H}`}
      width={pixelWidth}
      height={height}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label={text}
    >
      {segments}
    </svg>
  );
}

export default MazeGlyph;
