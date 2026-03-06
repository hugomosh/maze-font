import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio, auditPalette } from '../lib/colorUtils';
import { PALETTES } from '../lib/svgBuilder';

// ── Utility unit tests ───────────────────────────────────────────────────────

describe('relativeLuminance', () => {
  it('black is 0', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });

  it('white is 1', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('pure red channel only', () => {
    expect(relativeLuminance('#ff0000')).toBeCloseTo(0.2126, 4);
  });

  it('pure green channel only', () => {
    expect(relativeLuminance('#00ff00')).toBeCloseTo(0.7152, 4);
  });

  it('pure blue channel only', () => {
    expect(relativeLuminance('#0000ff')).toBeCloseTo(0.0722, 4);
  });
});

describe('contrastRatio', () => {
  it('black on white is 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('is symmetric — argument order does not matter', () => {
    const a = contrastRatio('#ff6b6b', '#1a1a2e');
    const b = contrastRatio('#1a1a2e', '#ff6b6b');
    expect(a).toBeCloseTo(b, 10);
  });

  it('identical colours have ratio 1', () => {
    expect(contrastRatio('#4ecdc4', '#4ecdc4')).toBeCloseTo(1, 5);
  });

  it('ratio is always ≥ 1', () => {
    const pairs = [
      ['#ffffff', '#eeeeee'],
      ['#000000', '#111111'],
      ['#ff0000', '#0000ff'],
    ];
    for (const [a, b] of pairs) {
      expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── Palette contrast report ──────────────────────────────────────────────────
// These tests document the contrast ratios of each palette but do not enforce
// WCAG thresholds — palette colours are chosen for aesthetics first.
// Use auditPalette() in colorUtils.js to check ratios when making changes.

describe('PALETTES contrast ratios (informational)', () => {
  it('logs a contrast table for all palettes', () => {
    const rows = [];

    for (const [name, pal] of Object.entries(PALETTES)) {
      const audit = auditPalette(pal);
      const mazeRatio = audit.mazeVsBg.toFixed(2);
      const glyphRatio = audit.glyphVsBg !== null ? audit.glyphVsBg.toFixed(2) : '—';
      const minLetter  = audit.minLetterRatio !== null ? audit.minLetterRatio.toFixed(2) : '—';
      rows.push({ palette: name, 'maze:bg': mazeRatio, 'glyph:bg': glyphRatio, 'min letter:bg': minLetter });
    }

    console.table(rows);

    // Sanity: every palette must return a finite maze ratio > 1
    for (const [name, pal] of Object.entries(PALETTES)) {
      const { mazeVsBg } = auditPalette(pal);
      expect(mazeVsBg, `${name} maze ratio`).toBeGreaterThan(1);
    }
  });
});
