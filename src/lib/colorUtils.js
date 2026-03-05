// src/lib/colorUtils.js
// WCAG 2.1 colour contrast utilities

/**
 * Convert a hex colour string to linearised sRGB components.
 * @param {string} hex  e.g. '#ff6b6b' or 'ff6b6b'
 * @returns {{ r: number, g: number, b: number }}  each in [0, 1] linear
 */
function hexToLinear(hex) {
  const h = hex.replace('#', '');
  const channels = [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
  const [r, g, b] = channels.map(c => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return { r, g, b };
}

/**
 * WCAG 2.1 relative luminance of a hex colour.
 * @param {string} hex
 * @returns {number}  luminance in [0, 1]
 */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.1 contrast ratio between two hex colours.
 * The order of arguments does not matter.
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number}  ratio ≥ 1
 */
export function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Audit a single palette object and return contrast ratios.
 *
 * @param {{ bg: string, maze: string, glyph: string|null, letterColors: string[]|null }} palette
 * @returns {{
 *   mazeVsBg: number,
 *   glyphVsBg: number|null,
 *   letterRatios: Array<{ color: string, ratio: number }>|null,
 *   minLetterRatio: number|null,
 * }}
 */
export function auditPalette(palette) {
  const mazeVsBg = contrastRatio(palette.maze, palette.bg);

  const glyphVsBg = palette.glyph !== null
    ? contrastRatio(palette.glyph, palette.bg)
    : null;

  const letterRatios = palette.letterColors
    ? palette.letterColors.map(color => ({
        color,
        ratio: contrastRatio(color, palette.bg),
      }))
    : null;

  const minLetterRatio = letterRatios
    ? Math.min(...letterRatios.map(r => r.ratio))
    : null;

  return { mazeVsBg, glyphVsBg, letterRatios, minLetterRatio };
}
