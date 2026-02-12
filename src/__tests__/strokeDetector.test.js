import { describe, it, expect } from 'vitest';
import { detectStrokes } from '../lib/strokeDetector';
import fontData from '../assets/maze-font.json';

const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 14; // Updated from 12 to 14
const CHAR_PADDING_UNITS = 1;
const CHAR_CELL_WIDTH_UNITS = CHAR_CONTENT_WIDTH + CHAR_PADDING_UNITS * 2; // 10
const CHAR_CELL_HEIGHT_UNITS = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2; // 16

describe('detectStrokes', () => {
  it('should correctly classify cells for character N', () => {
    const char = 'N';
    const { outsideCells, connectedStroke, potentialStroke } = detectStrokes(
      char,
      fontData,
      CHAR_CELL_WIDTH_UNITS,
      CHAR_CELL_HEIGHT_UNITS
    );

    // User states cells 3,5 and 3,12 for 'N' should be green (outside)
    // In grid coordinates, this means checking if they are NOT in connectedStroke
    // And ideally, they should be in outsideCells
    
    // (3,5) for 'N'
    expect(connectedStroke.has('3,5')).toBeFalsy();
    expect(outsideCells.has('3,5')).toBeTruthy();
    expect(potentialStroke.has('3,5')).toBeFalsy(); // Should not be a potential stroke if it's outside

    // (3,12) for 'N'
    expect(connectedStroke.has('3,12')).toBeFalsy();
    expect(outsideCells.has('3,12')).toBeTruthy();
    expect(potentialStroke.has('3,12')).toBeFalsy(); // Should not be a potential stroke if it's outside

    // Add more assertions based on expected behavior for 'N'
    // For example, parts of the actual 'N' stroke should be in connectedStroke
    expect(connectedStroke.has('2,2')).toBeTruthy();
    expect(connectedStroke.has('7,2')).toBeTruthy();
    expect(connectedStroke.has('5,7')).toBeTruthy();
  });

  it('should correctly classify cells for character 5', () => {
    const char = '5';
    const { outsideCells, connectedStroke, potentialStroke } = detectStrokes(
      char,
      fontData,
      CHAR_CELL_WIDTH_UNITS,
      CHAR_CELL_HEIGHT_UNITS
    );


    expect(connectedStroke.has('2,2')).toBeTruthy();
    expect(connectedStroke.has('7,12')).toBeTruthy(); // Check a cell in the extended height


    expect(outsideCells.has('1,7')).toBeTruthy();
    expect(outsideCells.has('8,3')).toBeTruthy();
    expect(outsideCells.has('4,3')).toBeTruthy();
    expect(connectedStroke.has('4,9')).toBeFalsy();
  });

  // Add more tests for other scenarios (e.g., enclosed corridors, isolated holes)
});
