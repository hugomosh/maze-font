import React, { useMemo } from 'react';
import fontData from '../assets/maze-font.json';
import { generateWordMaze } from '../lib/wordMazeGenerator';
import { mulberry32 } from '../lib/rng';
import { buildMazeLayerSvg, buildPathLayerSvg } from '../lib/svgBuilder';

// --- CONSTANTS ---
const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 14;
const CHAR_PADDING_UNITS = 2;

export const CHAR_CELL_WIDTH_UNITS  = CHAR_CONTENT_WIDTH  + CHAR_PADDING_UNITS * 2;
export const CHAR_CELL_HEIGHT_UNITS = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2;
export const UNIT_SIZE_EXPORT = 17;

// Stable hash of a few wall coords — fallback jitter seed when no explicit seed is given.
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
  // Destructure so each memo gets stable primitive dependencies.
  const {
    palette      = 'vivid',
    showPath     = false,
    regularWalls = false,
    handDrawn    = false,
    pathColor    = '#ff6b6b',
    pathOpacity  = 1.0,
    pathWidth    = 1.0,
  } = renderOptions ?? {};

  // ── Memo 1: maze generation (expensive) ──────────────────────────────────
  // Only reruns when text / layout / seed change.
  const mazeData = useMemo(() => {
    if (width === 0 || height === 0) return null;

    // Grid dimension computation
    let gridWidthUnits, gridHeightUnits;
    if (sizingMode === 'autofit' && text.trim().length > 0) {
      const words = text.split(' ').filter(w => w.length > 0);
      const longestWordLen = Math.max(...words.map(w => w.length), 1);
      const numWords = words.length;
      const COMPACT_MARGIN = 1;
      const minGridW = (longestWordLen + COMPACT_MARGIN * 2) * CHAR_CELL_WIDTH_UNITS;
      const minGridH = (numWords       + COMPACT_MARGIN * 2) * CHAR_CELL_HEIGHT_UNITS;
      const canvasAR = width / height;
      if (minGridW / minGridH < canvasAR) {
        gridWidthUnits  = Math.ceil(minGridH * canvasAR);
        gridHeightUnits = minGridH;
      } else {
        gridWidthUnits  = minGridW;
        gridHeightUnits = Math.ceil(minGridW / canvasAR);
      }
    } else {
      const baseGrid   = Math.floor(800 / 10);
      const aspectRatio = width / height;
      gridWidthUnits  = aspectRatio > 1 ? Math.floor(baseGrid * aspectRatio) : baseGrid;
      gridHeightUnits = aspectRatio > 1 ? baseGrid : Math.floor(baseGrid / aspectRatio);
    }

    const mazeRng = seed !== null && !isNaN(seed) ? mulberry32(seed) : null;
    const wmResult = generateWordMaze(
      text, gridWidthUnits, gridHeightUnits, fontData, mazeRng,
      sizingMode, verticalBias, position, textAlign,
    );

    // Actual maze extents → unitSize and offsets
    let mazeW = gridWidthUnits, mazeH = gridHeightUnits;
    if (wmResult.walls.length > 0) {
      mazeW = Math.max(...wmResult.walls.map(([x1,,x2]) => Math.max(x1, x2)));
      mazeH = Math.max(...wmResult.walls.map(([,y1,,y2]) => Math.max(y1, y2)));
    }
    const unitSize = Math.min(width / mazeW, height / mazeH);
    const offsetX  = (width  - mazeW * unitSize) / 2;
    const offsetY  = (height - mazeH * unitSize) / 2;

    // Seed for the hand-drawn jitter RNG — stable across path-option changes.
    const jitterSeed = ((seed ?? fingerprint(wmResult.walls)) + 0x5EED) >>> 0;

    return { wmResult, unitSize, offsetX, offsetY, jitterSeed, svgW: width, svgH: height };
  }, [width, height, text, sizingMode, verticalBias, position, textAlign, seed]);

  // ── Memo 2: maze walls SVG (cheap) ───────────────────────────────────────
  // Reruns only when the maze or visual palette changes — NOT on path changes.
  const mazeSvgStr = useMemo(() => {
    if (!mazeData) return '';
    const { wmResult, unitSize, offsetX, offsetY, svgW, svgH } = mazeData;
    return buildMazeLayerSvg(
      wmResult, fontData, { palette, regularWalls },
      svgW, svgH, unitSize, offsetX, offsetY,
    );
  }, [mazeData, palette, regularWalls]);

  // ── Memo 3: path layer SVG (cheap) ───────────────────────────────────────
  // Reruns only on path option changes — the maze is untouched.
  const pathSvgStr = useMemo(() => {
    if (!mazeData || !showPath) return '';
    const { wmResult, unitSize, offsetX, offsetY, svgW, svgH, jitterSeed } = mazeData;
    // Recreate jitter RNG from the stable seed so wobble is deterministic.
    const jitterRng = mulberry32(jitterSeed);
    return buildPathLayerSvg(
      wmResult, { showPath, handDrawn, pathColor, pathOpacity, pathWidth },
      svgW, svgH, unitSize, offsetX, offsetY, jitterRng,
    );
  }, [mazeData, showPath, handDrawn, pathColor, pathOpacity, pathWidth]);

  return (
    <div ref={ref} style={{ position: 'relative', lineHeight: 0 }}>
      <div dangerouslySetInnerHTML={{ __html: mazeSvgStr }} />
      {pathSvgStr && (
        <div
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          dangerouslySetInnerHTML={{ __html: pathSvgStr }}
        />
      )}
    </div>
  );
});

SvgGrid.displayName = 'SvgGrid';

export default SvgGrid;
