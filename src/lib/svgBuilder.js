// src/lib/svgBuilder.js
// Shared SVG building utilities used by SvgGrid.jsx and generate-batch.mjs

export const PALETTES = {
  vivid:     { bg: '#ffffff', maze: '#e0e0e0', glyph: null,      letterColors: ['#ff6b6b','#4ecdc4','#45b7d1','#f9ca24','#6c5ce7','#a29bfe','#fd79a8','#fdcb6e','#55efc4','#74b9ff'] },
  dark:      { bg: '#1a1a2e', maze: '#2d3561', glyph: null,      letterColors: ['#ff6b6b','#4ecdc4','#45b7d1','#f9ca24','#6c5ce7','#a29bfe','#fd79a8','#fdcb6e','#55efc4','#74b9ff'] },
  neon:      { bg: '#0d0d0d', maze: '#1a1a2a', glyph: null,      letterColors: ['#ff0090','#00fff0','#aaff00','#ff6600','#9900ff','#00ccff','#ff3366','#ccff00','#ff9900','#33ffcc'] },
  pastel:    { bg: '#fdf6f0', maze: '#e8d8cc', glyph: null,      letterColors: ['#ffb3ba','#ffdfba','#ffffba','#baffc9','#bae1ff','#e8baff','#ffd9f2','#c9f0d8','#f9dcc4','#d4e8ff'] },
  earth:     { bg: '#f5f0e8', maze: '#c8b89a', glyph: null,      letterColors: ['#c0392b','#8b5e3c','#d4882b','#6b8c42','#4a7c59','#7a4e2d','#b87333','#556b2f','#a0522d','#6b7c32'] },
  mono:      { bg: '#ffffff', maze: '#e0e0e0', glyph: '#2c3e50', letterColors: null },
  ink:       { bg: '#ffffff', maze: '#aaaaaa', glyph: '#000000', letterColors: null },
  blueprint: { bg: '#0a1628', maze: '#1a3a5c', glyph: '#7eb8d4', letterColors: null },
};

// Backwards-compat alias — batch script passes theme: 'classic' etc.
export const THEMES = {
  classic: PALETTES.vivid,
  dark:    PALETTES.dark,
  mono:    PALETTES.mono,
  ink:     PALETTES.ink,
};

export const LETTER_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7',
  '#a29bfe', '#fd79a8', '#fdcb6e', '#55efc4', '#74b9ff',
];

/**
 * Classify maze walls into glyph walls (per character) and maze walls.
 * @param {object} wmResult - word maze result with .walls and .characters
 * @param {object} fontData - font data JSON
 * @returns {{ glyphWalls: Map<number, Array>, mazeWalls: Array }}
 */
export function classifyWalls(wmResult, fontData) {
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

  return { glyphWalls, mazeWalls };
}

/**
 * Build an SVG path `d` string for a hand-drawn (jittered Catmull-Rom) path.
 * Start and end points are not jittered; intermediate points get a small
 * perpendicular wobble, then all points are smoothed via Catmull-Rom spline.
 *
 * @param {Array<{x,y}>} solutionPath - grid cell coords
 * @param {number} unitSize - pixels per grid unit
 * @param {function} rng - () => [0,1) random function
 * @returns {string} SVG path d attribute
 */
export function buildHandDrawnPathD(solutionPath, unitSize, rng) {
  if (solutionPath.length < 2) return '';

  // Convert to pixel coords (cell centers)
  const pts = solutionPath.map(({ x, y }) => ({
    x: (x + 0.5) * unitSize,
    y: (y + 0.5) * unitSize,
  }));

  // Apply perpendicular jitter with an exponential moving average so adjacent
  // points are correlated. Independent white noise produces rapid back-and-forth
  // waggling on straight corridors; smoothed drift creates gentle curves instead.
  const ALPHA = 0.6;  // smoothing: higher = slower drift changes (~1/(1-α) cell memory)
  const AMP   = 0.22; // max jitter as fraction of unitSize
  let drift = 0;
  const jittered = pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return { ...p };
    const prev = pts[i - 1];
    const next = pts[i + 1];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len;
    const py =  dx / len;
    drift = drift * ALPHA + (rng() - 0.5) * 2 * (1 - ALPHA);
    return { x: p.x + px * drift * unitSize * AMP, y: p.y + py * drift * unitSize * AMP };
  });

  // Catmull-Rom → Cubic Bezier conversion
  // Duplicate endpoints for boundary conditions
  const ps = [jittered[0], ...jittered, jittered[jittered.length - 1]];
  const f = v => v.toFixed(2);

  let d = `M ${f(ps[1].x)} ${f(ps[1].y)}`;
  for (let i = 1; i < ps.length - 2; i++) {
    const p0 = ps[i - 1], p1 = ps[i], p2 = ps[i + 1], p3 = ps[i + 2];
    // cp1 = p1 + (p2 - p0) / 6
    // cp2 = p2 - (p3 - p1) / 6
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${f(cp1x)} ${f(cp1y)}, ${f(cp2x)} ${f(cp2y)}, ${f(p2.x)} ${f(p2.y)}`;
  }

  return d;
}

/**
 * Build a complete SVG string for the maze.
 *
 * @param {object} wmResult - word maze result (.walls, .characters, .solutionPath)
 * @param {object} fontData - font data JSON
 * @param {object} renderOptions - rendering options (see below)
 * @param {number} svgW - SVG width in pixels
 * @param {number} svgH - SVG height in pixels
 * @param {number} unitSize - pixels per grid unit
 * @param {number} offsetX - horizontal offset to center content (pixels)
 * @param {number} offsetY - vertical offset to center content (pixels)
 * @param {function|null} rng - () => [0,1) for hand-drawn jitter; null = no jitter
 * @returns {string} complete SVG XML string
 *
 * renderOptions shape:
 * {
 *   theme:        'classic' | 'dark' | 'mono' | 'ink',
 *   showPath:     boolean,
 *   regularWalls: boolean,
 *   handDrawn:    boolean,
 *   pathColor:    string  (CSS color),
 *   pathWidth:    number  (multiplier on default stroke width),
 * }
 */
export function buildSvgString(wmResult, fontData, renderOptions, svgW, svgH, unitSize, offsetX, offsetY, rng) {
  const {
    palette: paletteId,
    customPalette,
    theme = 'classic',
    showPath = false,
    regularWalls = false,
    handDrawn = false,
    pathColor = '#ff6b6b',
    pathWidth = 1.0,
    pathOpacity = 1.0,
  } = renderOptions ?? {};

  const resolvedId = paletteId ?? (theme === 'classic' ? 'vivid' : theme);
  const th = (paletteId === 'custom' && customPalette)
    ? customPalette
    : PALETTES[resolvedId] ?? THEMES[resolvedId] ?? PALETTES.vivid;
  const paletteColors = th.letterColors ?? LETTER_COLORS;
  const { glyphWalls, mazeWalls } = classifyWalls(wmResult, fontData);
  const solutionPath = wmResult.solutionPath ?? [];

  const W = Number(svgW).toFixed(2);
  const H = Number(svgH).toFixed(2);
  const f = v => Number(v).toFixed(2);
  const mw = (unitSize * 0.25).toFixed(3);

  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`);
  lines.push(`<rect width="${W}" height="${H}" fill="${th.bg}"/>`);
  lines.push(`<g transform="translate(${f(offsetX)},${f(offsetY)})">`);

  // Maze walls — square linecap, 0.25u stroke
  for (const [x1, y1, x2, y2] of mazeWalls) {
    lines.push(
      `<line x1="${f(x1 * unitSize)}" y1="${f(y1 * unitSize)}"` +
      ` x2="${f(x2 * unitSize)}" y2="${f(y2 * unitSize)}"` +
      ` stroke="${th.maze}" stroke-width="${mw}" stroke-linecap="square"/>`
    );
  }

  // Glyph walls — colored or regularWalls, round/square linecap, 0.3u/0.25u stroke
  for (const [charIdx, walls] of glyphWalls) {
    const color = regularWalls
      ? th.maze
      : (th.glyph !== null ? th.glyph : paletteColors[charIdx % paletteColors.length]);
    const sw = (regularWalls ? unitSize * 0.25 : unitSize * 0.3).toFixed(3);
    const cap = regularWalls ? 'square' : 'round';
    for (const [x1, y1, x2, y2] of walls) {
      lines.push(
        `<line x1="${f(x1 * unitSize)}" y1="${f(y1 * unitSize)}"` +
        ` x2="${f(x2 * unitSize)}" y2="${f(y2 * unitSize)}"` +
        ` stroke="${color}" stroke-width="${sw}" stroke-linecap="${cap}"/>`
      );
    }
  }

  // Solution path
  if (showPath && solutionPath.length > 1) {
    const strokeW = (unitSize * 0.15 * pathWidth).toFixed(3);
    const op = Number(pathOpacity).toFixed(3);

    if (handDrawn && rng) {
      const d = buildHandDrawnPathD(solutionPath, unitSize, rng);
      lines.push(
        `<path d="${d}" fill="none" stroke="${pathColor}"` +
        ` stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`
      );
    } else {
      const pts = solutionPath
        .map(({ x, y }) => `${f((x + 0.5) * unitSize)},${f((y + 0.5) * unitSize)}`)
        .join(' ');
      lines.push(
        `<polyline points="${pts}" fill="none" stroke="${pathColor}"` +
        ` stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`
      );
    }

    // Start marker (green)
    const sx = f((solutionPath[0].x + 0.5) * unitSize);
    const sy = f((solutionPath[0].y + 0.5) * unitSize);
    lines.push(
      `<circle cx="${sx}" cy="${sy}" r="${(unitSize * 0.3).toFixed(3)}"` +
      ` fill="#51cf66" stroke="#2b8a3e" stroke-width="${(unitSize * 0.1).toFixed(3)}"/>`
    );

    // End marker (red)
    const last = solutionPath[solutionPath.length - 1];
    const ex = f((last.x + 0.5) * unitSize);
    const ey = f((last.y + 0.5) * unitSize);
    lines.push(
      `<circle cx="${ex}" cy="${ey}" r="${(unitSize * 0.3).toFixed(3)}"` +
      ` fill="#ff6b6b" stroke="#c92a2a" stroke-width="${(unitSize * 0.1).toFixed(3)}"/>`
    );
  }

  lines.push('</g>');
  lines.push('</svg>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Layered rendering — maze walls and path as separate SVG strings.
// SvgGrid stacks them so only the cheap path layer rerenders on slider drag.
// ---------------------------------------------------------------------------

/**
 * Build only the background + wall layers (no path).
 * Dependencies: wmResult, fontData, theme, regularWalls, dimensions.
 */
export function buildMazeLayerSvg(wmResult, fontData, renderOptions, svgW, svgH, unitSize, offsetX, offsetY) {
  const { palette: paletteId, customPalette, theme = 'classic', regularWalls = false } = renderOptions ?? {};
  const resolvedId = paletteId ?? (theme === 'classic' ? 'vivid' : theme);
  const th = (paletteId === 'custom' && customPalette)
    ? customPalette
    : PALETTES[resolvedId] ?? THEMES[resolvedId] ?? PALETTES.vivid;
  const paletteColors = th.letterColors ?? LETTER_COLORS;
  const { glyphWalls, mazeWalls } = classifyWalls(wmResult, fontData);

  const W = Number(svgW).toFixed(2);
  const H = Number(svgH).toFixed(2);
  const f = v => Number(v).toFixed(2);
  const mw = (unitSize * 0.25).toFixed(3);

  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`);
  lines.push(`<rect width="${W}" height="${H}" fill="${th.bg}"/>`);
  lines.push(`<g transform="translate(${f(offsetX)},${f(offsetY)})">`);

  for (const [x1, y1, x2, y2] of mazeWalls) {
    lines.push(
      `<line x1="${f(x1 * unitSize)}" y1="${f(y1 * unitSize)}"` +
      ` x2="${f(x2 * unitSize)}" y2="${f(y2 * unitSize)}"` +
      ` stroke="${th.maze}" stroke-width="${mw}" stroke-linecap="square"/>`
    );
  }

  for (const [charIdx, walls] of glyphWalls) {
    const color = regularWalls
      ? th.maze
      : (th.glyph !== null ? th.glyph : paletteColors[charIdx % paletteColors.length]);
    const sw = (regularWalls ? unitSize * 0.25 : unitSize * 0.3).toFixed(3);
    const cap = regularWalls ? 'square' : 'round';
    for (const [x1, y1, x2, y2] of walls) {
      lines.push(
        `<line x1="${f(x1 * unitSize)}" y1="${f(y1 * unitSize)}"` +
        ` x2="${f(x2 * unitSize)}" y2="${f(y2 * unitSize)}"` +
        ` stroke="${color}" stroke-width="${sw}" stroke-linecap="${cap}"/>`
      );
    }
  }

  lines.push('</g>');
  lines.push('</svg>');
  return lines.join('\n');
}

/**
 * Build only the path + markers layer (transparent background).
 * Returns empty string when showPath is false or path is too short.
 * Dependencies: wmResult, showPath, handDrawn, pathColor, pathWidth, rng, dimensions.
 */
export function buildPathLayerSvg(wmResult, renderOptions, svgW, svgH, unitSize, offsetX, offsetY, rng) {
  const {
    showPath = false,
    handDrawn = false,
    pathColor = '#ff6b6b',
    pathWidth = 1.0,
    pathOpacity = 1.0,
  } = renderOptions ?? {};

  const solutionPath = wmResult.solutionPath ?? [];
  if (!showPath || solutionPath.length < 2) return '';

  const W = Number(svgW).toFixed(2);
  const H = Number(svgH).toFixed(2);
  const f = v => Number(v).toFixed(2);
  const strokeW = (unitSize * 0.15 * pathWidth).toFixed(3);

  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`);
  lines.push(`<g transform="translate(${f(offsetX)},${f(offsetY)})">`);

  const op = Number(pathOpacity).toFixed(3);
  if (handDrawn && rng) {
    const d = buildHandDrawnPathD(solutionPath, unitSize, rng);
    lines.push(
      `<path d="${d}" fill="none" stroke="${pathColor}"` +
      ` stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`
    );
  } else {
    const pts = solutionPath
      .map(({ x, y }) => `${f((x + 0.5) * unitSize)},${f((y + 0.5) * unitSize)}`)
      .join(' ');
    lines.push(
      `<polyline points="${pts}" fill="none" stroke="${pathColor}"` +
      ` stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`
    );
  }

  const sx = f((solutionPath[0].x + 0.5) * unitSize);
  const sy = f((solutionPath[0].y + 0.5) * unitSize);
  lines.push(
    `<circle cx="${sx}" cy="${sy}" r="${(unitSize * 0.3).toFixed(3)}"` +
    ` fill="#51cf66" stroke="#2b8a3e" stroke-width="${(unitSize * 0.1).toFixed(3)}"/>`
  );

  const last = solutionPath[solutionPath.length - 1];
  lines.push(
    `<circle cx="${f((last.x + 0.5) * unitSize)}" cy="${f((last.y + 0.5) * unitSize)}"` +
    ` r="${(unitSize * 0.3).toFixed(3)}" fill="#ff6b6b" stroke="#c92a2a"` +
    ` stroke-width="${(unitSize * 0.1).toFixed(3)}"/>`
  );

  lines.push('</g>');
  lines.push('</svg>');
  return lines.join('\n');
}
