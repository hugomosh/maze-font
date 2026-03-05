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
    // linearise(255/255)=1.0; L = 0.2126*1 + 0 + 0 = 0.2126
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

// ── Palette contrast thresholds ──────────────────────────────────────────────

const MAZE_MIN    = 2.5;   // maze walls vs background
const LETTER_MIN  = 3.0;   // letter colours vs background
const GLYPH_MIN   = 4.5;   // mono-glyph colour vs background (WCAG AA text)

describe('PALETTES contrast audit', () => {
  for (const [name, pal] of Object.entries(PALETTES)) {
    describe(`palette: ${name}`, () => {
      const audit = auditPalette(pal);

      it(`maze (${pal.maze}) vs bg (${pal.bg}) ≥ ${MAZE_MIN}:1`, () => {
        expect(audit.mazeVsBg).toBeGreaterThanOrEqual(MAZE_MIN);
      });

      if (audit.glyphVsBg !== null) {
        it(`glyph (${pal.glyph}) vs bg (${pal.bg}) ≥ ${GLYPH_MIN}:1`, () => {
          expect(audit.glyphVsBg).toBeGreaterThanOrEqual(GLYPH_MIN);
        });
      }

      if (audit.letterRatios !== null) {
        for (const { color, ratio } of audit.letterRatios) {
          it(`letter ${color} vs bg (${pal.bg}) ≥ ${LETTER_MIN}:1`, () => {
            expect(ratio).toBeGreaterThanOrEqual(LETTER_MIN);
          });
        }
      }
    });
  }
});
