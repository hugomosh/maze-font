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
//   output/friend_classic.png  output/friend_dark.png  …

import { readFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { createRequire } from 'module';
import sharp from 'sharp';
import { generateWordMaze } from '../src/lib/wordMazeGenerator.js';
import { mulberry32 } from '../src/lib/rng.js';
import { buildSvgString } from '../src/lib/svgBuilder.js';

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
// Style config — each entry is a full renderOptions object
// ---------------------------------------------------------------------------
const STYLES = [
  { id: 'classic',      theme: 'classic', showPath: false, regularWalls: false, handDrawn: false, pathColor: '#ff6b6b', pathWidth: 1.0 },
  { id: 'dark',         theme: 'dark',    showPath: false, regularWalls: false, handDrawn: false, pathColor: '#ff6b6b', pathWidth: 1.0 },
  { id: 'classic-path', theme: 'classic', showPath: true,  regularWalls: false, handDrawn: true,  pathColor: '#ff6b6b', pathWidth: 1.0 },
  { id: 'dark-path',    theme: 'dark',    showPath: true,  regularWalls: false, handDrawn: true,  pathColor: '#74b9ff', pathWidth: 1.0 },
  { id: 'ink',          theme: 'ink',     showPath: false, regularWalls: false, handDrawn: false, pathColor: '#ff6b6b', pathWidth: 1.0 },
  { id: 'ink-walls',    theme: 'ink',     showPath: false, regularWalls: true,  handDrawn: false, pathColor: '#ff6b6b', pathWidth: 1.0 },
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
// CSV helpers
// ---------------------------------------------------------------------------

/** Parse one CSV line respecting double-quoted fields (handles commas and spaces inside quotes). */
function parseCSVLine(line) {
  const fields = [];
  let inQuote = false;
  let current = '';
  for (const ch of line) {
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Transliterate accented characters.
 * If the font has a glyph for the character (e.g. Ñ), keep it as-is.
 * Otherwise strip the diacritic to get the ASCII base letter (á→a, é→e, …).
 */
function transliterate(str) {
  return [...str].map(ch => {
    if (fontData[ch.toUpperCase()]) return ch;           // font supports it — keep
    return ch.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip diacritic
  }).join('');
}

/** Parse CSV, returning { nombre, canonicalId } per data row. */
function parseCSV(csvPath) {
  const csv = readFileSync(resolve(csvPath), 'utf8');
  const lines = csv.split('\n').map(l => l.replace(/\r$/, ''));
  if (lines.length === 0) { console.error('Error: CSV is empty'); process.exit(1); }

  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const nombreIdx    = header.findIndex(h => h === 'nombre');
  const canonicalIdx = header.findIndex(h => h === 'canonical_id');

  if (nombreIdx === -1) {
    console.error('Error: CSV must have a "nombre" column in the header row');
    process.exit(1);
  }

  return lines.slice(1)
    .map(l => {
      const fields = parseCSVLine(l);
      const nombre = fields[nombreIdx]?.trim();
      const canonicalId = canonicalIdx !== -1 ? fields[canonicalIdx]?.trim() : null;
      return nombre ? { nombre, canonicalId } : null;
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Name → safe filename (transliterate first so é→e in filenames too)
// ---------------------------------------------------------------------------
function normalizeName(name) {
  return transliterate(name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const [,, csvPath = 'names.csv', outDir = 'output', fallbackSeed = '42'] = process.argv;
  const baseSeed = parseInt(fallbackSeed, 10) || 42;

  const entries = parseCSV(csvPath);
  mkdirSync(resolve(outDir), { recursive: true });

  const total = entries.length;
  const startTime = Date.now();

  for (let i = 0; i < total; i++) {
    const { nombre, canonicalId } = entries[i];

    // canonical_id is written in base 3 — parse it to get a base-10 integer seed.
    const seed = (canonicalId && /^[012]+$/.test(canonicalId))
      ? parseInt(canonicalId, 3)
      : baseSeed + i;

    // Transliterate accents before passing to the maze generator
    const mazeName = transliterate(nombre);
    const normalized = normalizeName(nombre);

    const { gridW, gridH } = computeGridSize(mazeName);
    const mazeRng = mulberry32(seed);
    const wmResult = generateWordMaze(
      mazeName, gridW, gridH, fontData, mazeRng,
      'autofit', 1, 'center', 'center',
    );

    // Compute layout — caller's responsibility in the shared library model
    let maxX = 0, maxY = 0;
    for (const [x1, y1, x2, y2] of wmResult.walls) {
      if (x1 > maxX) maxX = x1; if (x2 > maxX) maxX = x2;
      if (y1 > maxY) maxY = y1; if (y2 > maxY) maxY = y2;
    }
    const unitSize = TARGET_PX / Math.max(maxX, maxY, 1);
    const svgW = maxX * unitSize;
    const svgH = maxY * unitSize;

    const filenames = [];
    for (const style of STYLES) {
      // Separate jitter RNG per style so hand-drawn paths are reproducible
      const jitterRng = mulberry32((seed ^ 0x5EED) >>> 0);

      const filename = `${normalized}_${style.id}.png`;
      const outPath = join(resolve(outDir), filename);
      const svgStr = buildSvgString(wmResult, fontData, style, svgW, svgH, unitSize, 0, 0, jitterRng);
      await sharp(Buffer.from(svgStr)).png().toFile(outPath);
      filenames.push(filename);
    }

    process.stdout.write(`[${i + 1}/${total}] ${nombre} (seed ${seed}) → ${filenames.join('  ')}\n`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone. ${total * STYLES.length} files in ${elapsed}s`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
