export const CELL_SIZE = 20;
export const GRID_WIDTH = 10;
export const GRID_HEIGHT = 16;

export const CHAR_CONTENT_WIDTH = 8;
export const CHAR_CONTENT_HEIGHT = 14;
export const CHAR_PADDING_UNITS = 1;

export const DIAMOND_COLOR = '#e2e8f0';
export const AXIS_COLOR = '#94a3b8';
export const WALL_COLOR = '#1e293b';

export const isDiamondNode = (x, y) => (x + y) % 2 === 0;

export const serializeWall = (wall) => {
  const { p1, p2 } = wall;
  // Serialize with a consistent point order to treat p1-p2 and p2-p1 as the same wall
  if (p1.x < p2.x || (p1.x === p2.x && p1.y < p2.y)) {
    return `${p1.x},${p1.y},${p2.x},${p2.y}`;
  }
  return `${p2.x},${p2.y},${p1.x},${p1.y}`;
};

export const wallsToStrokeDetectorFormat = (walls) => {
  if (!walls) return [];
  return walls.map(wall => [wall.p1.x, wall.p1.y, wall.p2.x, wall.p2.y]);
};

