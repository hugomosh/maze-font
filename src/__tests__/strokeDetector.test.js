import { describe, it, expect } from 'vitest';
import { detectStrokes } from '../lib/strokeDetector';
import fontData from '../assets/maze-font.json';

const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 14;
const CHAR_PADDING_UNITS = 1;
const CHAR_CELL_WIDTH_UNITS = CHAR_CONTENT_WIDTH + CHAR_PADDING_UNITS * 2; // 10
const CHAR_CELL_HEIGHT_UNITS = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2; // 16

describe('detectStrokes', () => {
  it('should correctly classify cells for character N', () => {
    const char = 'N';
    const { outsideCells, enclosedCorridors, reachable } = detectStrokes(
      char,
      fontData,
      CHAR_CELL_WIDTH_UNITS,
      CHAR_CELL_HEIGHT_UNITS
    );

    // Letter strokes (purple) - these cells are part of the 'N' strokes
    expect(enclosedCorridors.has('1,1')).toBeTruthy();
    expect(enclosedCorridors.has('2,2')).toBeTruthy();
    expect(enclosedCorridors.has('5,12')).toBeTruthy();
    expect(enclosedCorridors.has('7,2')).toBeTruthy();

    // Outside areas (green) - where maze will be generated
    expect(outsideCells.has('3,3')).toBeTruthy();
    expect(outsideCells.has('4,12')).toBeTruthy();

    // These should NOT be strokes
    expect(enclosedCorridors.has('3,3')).toBeFalsy();
    expect(enclosedCorridors.has('4,12')).toBeFalsy();
  });

  it('should correctly classify cells for character 5', () => {
    const char = '5';
    const { outsideCells, enclosedCorridors } = detectStrokes(
      char,
      fontData,
      CHAR_CELL_WIDTH_UNITS,
      CHAR_CELL_HEIGHT_UNITS
    );

    // Outside areas (green) - where maze will be generated
    expect(outsideCells.has('1,7')).toBeTruthy();
    expect(outsideCells.has('2,8')).toBeTruthy();
    expect(outsideCells.has('8,3')).toBeTruthy();
    expect(outsideCells.has('4,3')).toBeTruthy();

    // These should NOT be strokes
    expect(enclosedCorridors.has('1,7')).toBeFalsy();
    expect(enclosedCorridors.has('2,8')).toBeFalsy();
    expect(enclosedCorridors.has('8,3')).toBeFalsy();
    expect(enclosedCorridors.has('4,3')).toBeFalsy();
  });

  it('should correctly classify cells for character 7', () => {
    const char = '7';
    const { enclosedCorridors } = detectStrokes(
      char,
      fontData,
      CHAR_CELL_WIDTH_UNITS,
      CHAR_CELL_HEIGHT_UNITS
    );

    // Bottom of the stroke
    expect(enclosedCorridors.has('7,12')).toBeTruthy();
    expect(enclosedCorridors.has('8,12')).toBeTruthy();
  });

  it('should correctly classify cells for character 8', () => {
    const char = '8';
    const { outsideCells, enclosedCorridors, reachable } = detectStrokes(
      char,
      fontData,
      CHAR_CELL_WIDTH_UNITS,
      CHAR_CELL_HEIGHT_UNITS
    );

    // Three-way stroke intersection (left side)
    expect(enclosedCorridors.has('1,5')).toBeTruthy();
    expect(enclosedCorridors.has('1,6')).toBeTruthy();
    expect(enclosedCorridors.has('2,5')).toBeTruthy();
    expect(enclosedCorridors.has('2,6')).toBeTruthy();

    // Upper hole (blue) - NOT reachable, NOT strokes
    expect(reachable.has('3,3')).toBeFalsy();
    expect(reachable.has('3,4')).toBeFalsy();
    expect(reachable.has('4,3')).toBeFalsy();
    expect(reachable.has('4,4')).toBeFalsy();
    expect(reachable.has('5,3')).toBeFalsy();
    expect(reachable.has('5,4')).toBeFalsy();
    expect(reachable.has('6,3')).toBeFalsy();
    expect(reachable.has('6,4')).toBeFalsy();

    expect(enclosedCorridors.has('3,3')).toBeFalsy();
    expect(enclosedCorridors.has('6,3')).toBeFalsy();

    // Lower hole (blue) - NOT reachable, NOT strokes
    expect(reachable.has('3,7')).toBeFalsy();
    expect(reachable.has('3,10')).toBeFalsy();
    expect(reachable.has('6,7')).toBeFalsy();
    expect(reachable.has('6,10')).toBeFalsy();

    expect(enclosedCorridors.has('3,7')).toBeFalsy();
    expect(enclosedCorridors.has('6,10')).toBeFalsy();
  });
});
