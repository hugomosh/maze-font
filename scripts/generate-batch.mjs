// Batch PNG generator for maze-font names.
//
// Usage:
//   node --loader ./scripts/loader.mjs scripts/generate-batch.mjs [csv] [outDir] [seed]
//   npm run generate -- names.csv output/ 42
//
// Defaults: names.csv  output/  42
//
// The CSV must have a "nombre" header column (case-insensitive).
// Produces one PNG per name × style combination, e.g.:
//   output/kawa_classic.png  output/kawa_dark.png  …

import { readFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { createRequire } from 'module';
import sharp from 'sharp';
import { generateWordMaze } from '../src/lib/wordMazeGenerator.js';
import { mulberry32 } from '../src/lib/rng.js';

// JSON import via createRequire — works in Node 18+ without import assertions
const _require = createRequire(import.meta.url);
const fontData = _require('../src/assets/maze-font.json');

// ---------------------------------------------------------------------------
// Constants — must match SvgGrid.jsx / wordMazeGenerator.js exactly
// ---------------------------------------------------------------------------
const CHAR_CONTENT_WIDTH  = 8;
const CHAR_CONTENT_HEIGHT = 14;
const CHAR_PADDING_UNITS  = 2;
const CHAR_CELL_W = CHAR_CONTENT_WIDTH  + CHAR_PADDING_UNITS * 2; // 12
const CHAR_CELL_H = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2; // 18
const COMPACT_MARGIN = 1;

/** Larger output dimension in pixels. Both dimensions ≈ TARGET_PX for square output. */
const TARGET_PX = 1200;

// ---------------------------------------------------------------------------
// Themes — must match SvgGrid.jsx THEMES
// ---------------------------------------------------------------------------
const THEMES = {
  classic: { bg: '#fdfdfd', maze: '#d4d4d4', glyph: null },
  dark:    { bg: '#1a1a2e', maze: '#2d3561', glyph: null },
  mono:    { bg: '#ffffff', maze: '#e0e0e0', glyph: '#2c3e50' },
  ink:     { bg: '#ffffff', maze: '#aaaaaa', glyph: '#000000' },
};

const LETTER_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7',
  '#a29bfe', '#fd79a8', '#fdcb6e', '#55efc4', '#74b9ff',
];

// ---------------------------------------------------------------------------
// Style config — edit this array to add/remove output variants
// ---------------------------------------------------------------------------
const STYLES = [
  { id: 'classic',      theme: 'classic', showPath: false, regularWalls: false },
  { id: 'dark',         theme: 'dark',    showPath: false, regularWalls: false },
  { id: 'classic-path', theme: 'classic', showPath: true,  regularWalls: false },
  { id: 'ink-walls',    theme: 'ink',     showPath: false, regularWalls: true  },
];

// ---------------------------------------------------------------------------
// Grid sizing: square 1:1, autofit (port of SvgGrid autofit logic)
// ---------------------------------------------------------------------------
function computeGridSize(text) {
  const words = text.split(' ').filter(w => w.length > 0);
  const longestWordLen = Math.max(...words.map(w => w.length), 1);
  const numWords = words.length;
  const minGridW = (longestWordLen + COMPACT_MARGIN * 2) * CHAR_CELL_W;
  const minGridH = (numWords       + COMPACT_MARGIN * 2) * CHAR_CELL_H;
  // Square: extend the shorter dimension to match the longer one
  const gridUnits = Math.max(minGridW, minGridH);
  return { gridW: gridUnits, gridH: gridUnits };
}

// ---------------------------------------------------------------------------
// SVG builder — port of SvgGrid useMemo rendering, pure string output
// ---------------------------------------------------------------------------
function buildSvg(wmResult, style) {
  const th = THEMES[style.theme] ?? THEMES.classic;

  // Step 1: Build potential glyph walls from fontData per character
  const potentialGlyphWalls = new Map();
  wmResult.characters.forEach((charInfo, index) => {
    const charData = fontData[charInfo.char.toUpperCase()];
    if (!charData) { potentialGlyphWalls.set(index, []); return; }
    const walls = [];
    for (const [x1, y1, x2, y2] of charData) {
      const gx1 = charInfo.x + x1, gy1 = charInfo.y + y1;
      const gx2 = charInfo.x + x2, gy2 = charInfo.y + y2;
      if (gx1 === gx2) {
        const minY = Math.min(gy1, gy2), maxY = Math.max(gy1, gy2);
        for (let gy = minY; gy < maxY; gy++) walls.push([gx1, gy, gx1, gy + 1]);
      } else if (gy1 === gy2) {
        const minX = Math.min(gx1, gx2), maxX = Math.max(gx1, gx2);
        for (let gx = minX; gx < maxX; gx++) walls.push([gx, gy1, gx + 1, gy1]);
      }
    }
    potentialGlyphWalls.set(index, walls);
  });

  // Step 2: Intersect with finalWallSet → glyphWalls
  const finalWallSet = new Set(wmResult.walls.map(w => w.join(',')));
  const glyphWalls = new Map();
  for (const [idx, walls] of potentialGlyphWalls) {
    glyphWalls.set(idx, walls.filter(w => finalWallSet.has(w.join(','))));
  }

  // Step 3: glyphWallSet → mazeWalls (all non-glyph walls)
  const glyphWallSet = new Set();
  for (const walls of glyphWalls.values())
    for (const w of walls) glyphWallSet.add(w.join(','));
  const mazeWalls = wmResult.walls.filter(w => !glyphWallSet.has(w.join(',')));

  // Step 4: Compute actual maze extents → unitSize
  let maxX = 0, maxY = 0;
  for (const [x1, y1, x2, y2] of wmResult.walls) {
    if (x1 > maxX) maxX = x1; if (x2 > maxX) maxX = x2;
    if (y1 > maxY) maxY = y1; if (y2 > maxY) maxY = y2;
  }
  const unitSize = TARGET_PX / Math.max(maxX, maxY, 1);
  const svgW = (maxX * unitSize).toFixed(2);
  const svgH = (maxY * unitSize).toFixed(2);

  // Step 5: Build SVG string
  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">`);
  lines.push(`<rect width="${svgW}" height="${svgH}" fill="${th.bg}"/>`);

  // Maze walls — square linecap, width 0.25u
  const mw = (unitSize * 0.25).toFixed(3);
  for (const [x1, y1, x2, y2] of mazeWalls) {
    lines.push(
      `<line x1="${(x1 * unitSize).toFixed(2)}" y1="${(y1 * unitSize).toFixed(2)}"` +
      ` x2="${(x2 * unitSize).toFixed(2)}" y2="${(y2 * unitSize).toFixed(2)}"` +
      ` stroke="${th.maze}" stroke-width="${mw}" stroke-linecap="square"/>`
    );
  }

  // Glyph walls — colored / mono, round linecap, width 0.3u (or 0.25u for regularWalls)
  for (const [charIdx, walls] of glyphWalls) {
    const color = style.regularWalls
      ? th.maze
      : (th.glyph !== null ? th.glyph : LETTER_COLORS[charIdx % LETTER_COLORS.length]);
    const sw = (style.regularWalls ? unitSize * 0.25 : unitSize * 0.3).toFixed(3);
    const cap = style.regularWalls ? 'square' : 'round';
    for (const [x1, y1, x2, y2] of walls) {
      lines.push(
        `<line x1="${(x1 * unitSize).toFixed(2)}" y1="${(y1 * unitSize).toFixed(2)}"` +
        ` x2="${(x2 * unitSize).toFixed(2)}" y2="${(y2 * unitSize).toFixed(2)}"` +
        ` stroke="${color}" stroke-width="${sw}" stroke-linecap="${cap}"/>`
      );
    }
  }

  // Solution path (polyline + start/end markers)
  const solutionPath = wmResult.solutionPath ?? [];
  if (style.showPath && solutionPath.length > 1) {
    const pts = solutionPath
      .map(({ x, y }) => `${((x + 0.5) * unitSize).toFixed(2)},${((y + 0.5) * unitSize).toFixed(2)}`)
      .join(' ');
    lines.push(
      `<polyline points="${pts}" fill="none" stroke="#ff6b6b"` +
      ` stroke-width="${(unitSize * 0.15).toFixed(3)}"` +
      ` stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>`
    );
    // Start marker (green)
    const sx = ((solutionPath[0].x + 0.5) * unitSize).toFixed(2);
    const sy = ((solutionPath[0].y + 0.5) * unitSize).toFixed(2);
    lines.push(
      `<circle cx="${sx}" cy="${sy}" r="${(unitSize * 0.3).toFixed(3)}"` +
      ` fill="#51cf66" stroke="#2b8a3e" stroke-width="${(unitSize * 0.1).toFixed(3)}"/>`
    );
    // End marker (red)
    const ex = ((solutionPath[solutionPath.length - 1].x + 0.5) * unitSize).toFixed(2);
    const ey = ((solutionPath[solutionPath.length - 1].y + 0.5) * unitSize).toFixed(2);
    lines.push(
      `<circle cx="${ex}" cy="${ey}" r="${(unitSize * 0.3).toFixed(3)}"` +
      ` fill="#ff6b6b" stroke="#c92a2a" stroke-width="${(unitSize * 0.1).toFixed(3)}"/>`
    );
  }

  lines.push('</svg>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------
function parseNames(csvPath) {
  const csv = readFileSync(resolve(csvPath), 'utf8');
  const lines = csv.split('\n').map(l => l.replace(/\r$/, ''));
  if (lines.length === 0) { console.error('Error: CSV is empty'); process.exit(1); }

  const header = lines[0].toLowerCase().split(',');
  const nombreIdx = header.findIndex(h => h.trim() === 'nombre');
  if (nombreIdx === -1) {
    console.error('Error: CSV must have a "nombre" column in the header row');
    process.exit(1);
  }

  return lines.slice(1)
    .map(l => l.split(',')[nombreIdx]?.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Name → safe filename
// ---------------------------------------------------------------------------
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const [,, csvPath = 'names.csv', outDir = 'output', seedArg = '42'] = process.argv;
  const baseSeed = parseInt(seedArg, 10) || 42;

  const names = parseNames(csvPath);
  mkdirSync(resolve(outDir), { recursive: true });

  const total = names.length;
  const startTime = Date.now();

  for (let i = 0; i < total; i++) {
    const name = names[i];
    const normalized = normalizeName(name);

    const { gridW, gridH } = computeGridSize(name);
    const rng = mulberry32(baseSeed + i);
    const wmResult = generateWordMaze(
      name, gridW, gridH, fontData, rng,
      'autofit', 1, 'center', 'center',
    );

    const filenames = [];
    for (const style of STYLES) {
      const filename = `${normalized}_${style.id}.png`;
      const outPath = join(resolve(outDir), filename);
      const svgStr = buildSvg(wmResult, style);
      await sharp(Buffer.from(svgStr)).png().toFile(outPath);
      filenames.push(filename);
    }

    process.stdout.write(`[${i + 1}/${total}] ${name} → ${filenames.join('  ')}\n`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone. ${total * STYLES.length} files in ${elapsed}s`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
