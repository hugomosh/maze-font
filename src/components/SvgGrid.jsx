import React, { useMemo } from 'react';
import fontData from '../assets/maze-font.json';
import { generateWordMaze } from '../lib/wordMazeGenerator';
import { mulberry32 } from '../lib/rng';
import { buildSvgString } from '../lib/svgBuilder';

// --- CONSTANTS ---
const BASE_UNIT_SIZE = 17;
const MIN_UNIT_SIZE = 8;
const MAX_UNIT_SIZE = 20;
const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 14;
const CHAR_PADDING_UNITS = 2;

export const CHAR_CELL_WIDTH_UNITS = CHAR_CONTENT_WIDTH + CHAR_PADDING_UNITS * 2;
export const CHAR_CELL_HEIGHT_UNITS = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2;
export const UNIT_SIZE_EXPORT = BASE_UNIT_SIZE;

// Stable hash of a few wall coordinates — used as a fallback seed for jitter RNG
// when no explicit seed is given. Ensures reproducible jitter for the same maze.
function fingerprint(walls) {
  let h = 0;
  const n = Math.min(walls.length, 20);
  for (let i = 0; i < n; i++) {
    h = (Math.imul(h, 31) + walls[i][0] * 1000 + walls[i][1]) | 0;
  }
  return h >>> 0;
}

const SvgGrid = React.forwardRef(({
  width, height, text,
  renderOptions,
  sizingMode = 'autofit',
  verticalBias = 1,
  position = 'center',
  textAlign = 'center',
  seed = null,
}, ref) => {
  // Destructure renderOptions so useMemo gets stable primitive dependencies
  const {
    theme = 'classic',
    showPath = false,
    regularWalls = false,
    handDrawn = false,
    pathColor = '#ff6b6b',
    pathWidth = 1.0,
  } = renderOptions ?? {};

  const svgStr = useMemo(() => {
    if (width === 0 || height === 0) return '';

    // Grid dimension computation
    let gridWidthUnits, gridHeightUnits;
    if (sizingMode === 'autofit' && text.trim().length > 0) {
      const words = text.split(' ').filter(w => w.length > 0);
      const longestWordLen = Math.max(...words.map(w => w.length), 1);
      const numWords = words.length;
      const COMPACT_MARGIN = 1;
      const minGridW = (longestWordLen + COMPACT_MARGIN * 2) * CHAR_CELL_WIDTH_UNITS;
      const minGridH = (numWords + COMPACT_MARGIN * 2) * CHAR_CELL_HEIGHT_UNITS;
      const canvasAR = width / height;
      if (minGridW / minGridH < canvasAR) {
        gridWidthUnits = Math.ceil(minGridH * canvasAR);
        gridHeightUnits = minGridH;
      } else {
        gridWidthUnits = minGridW;
        gridHeightUnits = Math.ceil(minGridW / canvasAR);
      }
    } else {
      const referenceSize = 800;
      const targetUnitSize = 10;
      const baseGrid = Math.floor(referenceSize / targetUnitSize);
      const aspectRatio = width / height;
      gridWidthUnits = aspectRatio > 1 ? Math.floor(baseGrid * aspectRatio) : baseGrid;
      gridHeightUnits = aspectRatio > 1 ? baseGrid : Math.floor(baseGrid / aspectRatio);
    }

    const mazeRng = seed !== null && !isNaN(seed) ? mulberry32(seed) : null;
    const wmResult = generateWordMaze(text, gridWidthUnits, gridHeightUnits, fontData, mazeRng, sizingMode, verticalBias, position, textAlign);

    // Actual maze extents
    let actualMazeWidthUnits = gridWidthUnits;
    let actualMazeHeightUnits = gridHeightUnits;
    if (wmResult.walls.length > 0) {
      const maxX = Math.max(...wmResult.walls.map(([x1, , x2]) => Math.max(x1, x2)));
      const maxY = Math.max(...wmResult.walls.map(([, y1, , y2]) => Math.max(y1, y2)));
      actualMazeWidthUnits = maxX;
      actualMazeHeightUnits = maxY;
    }

    const unitSizeFromWidth = width / actualMazeWidthUnits;
    const unitSizeFromHeight = height / actualMazeHeightUnits;
    const unitSize = Math.min(unitSizeFromWidth, unitSizeFromHeight);

    const mazeWidth = actualMazeWidthUnits * unitSize;
    const mazeHeight = actualMazeHeightUnits * unitSize;
    const offsetX = (width - mazeWidth) / 2;
    const offsetY = (height - mazeHeight) / 2;

    // Seeded jitter RNG — separate from the maze generation RNG
    const jitterSeed = ((seed ?? fingerprint(wmResult.walls)) + 0x5EED) >>> 0;
    const jitterRng = mulberry32(jitterSeed);

    return buildSvgString(
      wmResult, fontData,
      { theme, showPath, regularWalls, handDrawn, pathColor, pathWidth },
      width, height, unitSize, offsetX, offsetY,
      jitterRng,
    );
  }, [width, height, text, sizingMode, verticalBias, position, textAlign, seed,
      theme, showPath, regularWalls, handDrawn, pathColor, pathWidth]);

  return (
    <div ref={ref} style={{ lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svgStr }} />
  );
});

SvgGrid.displayName = 'SvgGrid';

export default SvgGrid;
