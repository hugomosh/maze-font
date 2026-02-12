// strokeDetector.js
// This file will contain the logic for detecting strokes, extracted from StrokeTest.jsx

// Helper functions for stroke detection
const hasWall = (fixedWalls, x, y, dir) => {
  const fixed = fixedWalls.get(`${x},${y}`);
  return !!(fixed && fixed[dir]);
};

const isVerticalCorridor = (fixedWalls, x, y) =>
  !!(hasWall(fixedWalls, x, y, "left") && hasWall(fixedWalls, x + 1, y, "right"));
const isHorizontalCorridor = (fixedWalls, x, y) =>
  !!(hasWall(fixedWalls, x, y, "top") && hasWall(fixedWalls, x, y + 1, "bottom"));


export function detectStrokes(char, fontData, gridWidth, gridHeight) {
  const charData = fontData[char.toUpperCase()];
  if (!charData)
    return {
      fixedWalls: new Map(),
      potentialStroke: new Set(),
      connectedStroke: new Set(),
      outsideCells: new Set(),
      enclosedCorridors: new Set(),
    };

  // Build fixed walls from font data
  const fixedWalls = new Map();
  const setFixed = (x, y, dir) => {
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return;
    const key = `${x},${y}`;
    if (!fixedWalls.has(key)) {
      fixedWalls.set(key, {
        top: false,
        right: false,
        bottom: false,
        left: false,
      });
    }
    fixedWalls.get(key)[dir] = true;
  };

  for (const [x1, y1, x2, y2] of charData) {
    const gx1 = x1;
    const gy1 = y1;
    const gx2 = x2;
    const gy2 = y2;

    if (gx1 === gx2) {
      const gx = gx1;
      const minY = Math.min(gy1, gy2);
      const maxY = Math.max(gy1, gy2);
      for (let gy = minY; gy < maxY; gy++) {
        setFixed(gx - 1, gy, "right");
        setFixed(gx, gy, "left");
      }
    } else if (gy1 === gy2) {
      const gy = gy1;
      const minX = Math.min(gx1, gx2);
      const maxX = Math.max(gx1, gx2);
      for (let gx = minX; gx < maxX; gx++) {
        setFixed(gx, gy - 1, "bottom");
        setFixed(gx, gy, "top");
      }
    }
  }

  // Content area (excluding padding)
  const contentAreaCells = new Set();
  for (let dy = 1; dy < gridHeight - 1; dy++) {
    for (let dx = 1; dx < gridWidth - 1; dx++) {
      contentAreaCells.add(`${dx},${dy}`);
    }
  }

  // Find reachable cells
  const reachable = new Set();
  const queue = [];
  const canMove = (x, y, dir) => {
    const fixed = fixedWalls.get(`${x},${y}`);
    if (fixed && fixed[dir]) return false;
    return true;
  };

  for (let x = 0; x < gridWidth; x++) {
    queue.push({ x, y: 0 });
    queue.push({ x, y: gridHeight - 1 });
  }
  for (let y = 0; y < gridHeight; y++) {
    queue.push({ x: 0, y });
    queue.push({ x: gridWidth - 1, y });
  }

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    const key = `${x},${y}`;
    if (reachable.has(key)) continue;
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) continue;
    reachable.add(key);

    if (y > 0 && canMove(x, y, "top") && canMove(x, y - 1, "bottom"))
      queue.push({ x, y: y - 1 });
    if (
      x < gridWidth - 1 &&
      canMove(x, y, "right") &&
      canMove(x + 1, y, "left")
    )
      queue.push({ x: x + 1, y });
    if (
      y < gridHeight - 1 &&
      canMove(x, y, "bottom") &&
      canMove(x, y + 1, "top")
    )
      queue.push({ x, y: y + 1 });
    if (x > 0 && canMove(x, y, "left") && canMove(x - 1, y, "right"))
      queue.push({ x: x - 1, y });
  }

  // Letter strokes are ALL 2-cell-wide corridors (enclosed by walls)
  // We filter out "holes" by checking if they're reachable from outside
  const potentialStroke = new Set(); // Keep for compatibility, but unused
  const connectedStroke = new Set(); // Keep for compatibility, but unused

  // SIMPLIFIED: Strokes are cells with walls from font lines
  // Cells with 3+ walls = always strokes (corners/intersections)
  // Cells with 2 walls = strokes only if part of 2-cell corridor with internal wall
  const enclosedCorridors = new Set();

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const key = `${x},${y}`;

      // Check all content cells
      if (!contentAreaCells.has(key)) continue;

      // Count walls for this cell
      const wallCount =
        (hasWall(fixedWalls, x, y, "top") ? 1 : 0) +
        (hasWall(fixedWalls, x, y, "right") ? 1 : 0) +
        (hasWall(fixedWalls, x, y, "bottom") ? 1 : 0) +
        (hasWall(fixedWalls, x, y, "left") ? 1 : 0);

      // 3+ walls = always stroke (corners/intersections)
      if (wallCount >= 3) {
        enclosedCorridors.add(key);
        continue;
      }

      // 2 walls on opposite sides = corridor = stroke
      if (wallCount === 2) {
        const hasLeft = hasWall(fixedWalls, x, y, "left");
        const hasRight = hasWall(fixedWalls, x, y, "right");
        const hasTop = hasWall(fixedWalls, x, y, "top");
        const hasBottom = hasWall(fixedWalls, x, y, "bottom");

        const isVerticalCorridor = hasLeft && hasRight;
        const isHorizontalCorridor = hasTop && hasBottom;

        if (isVerticalCorridor || isHorizontalCorridor) {
          enclosedCorridors.add(key);
        }
      }
    }
  }

  // FLOOD FILL: Propagate strokes to adjacent corners (2 adjacent walls) if no wall between
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const key = `${x},${y}`;

        // Skip if already a stroke or not content
        if (!contentAreaCells.has(key)) continue;
        if (enclosedCorridors.has(key)) continue;

        // Check if this is a corner (2 adjacent walls)
        const wallCount =
          (hasWall(fixedWalls, x, y, "top") ? 1 : 0) +
          (hasWall(fixedWalls, x, y, "right") ? 1 : 0) +
          (hasWall(fixedWalls, x, y, "bottom") ? 1 : 0) +
          (hasWall(fixedWalls, x, y, "left") ? 1 : 0);

        if (wallCount !== 2) continue; // Not a corner

        const hasLeft = hasWall(fixedWalls, x, y, "left");
        const hasRight = hasWall(fixedWalls, x, y, "right");
        const hasTop = hasWall(fixedWalls, x, y, "top");
        const hasBottom = hasWall(fixedWalls, x, y, "bottom");

        // Skip if not adjacent walls (if opposite, already handled above)
        if ((hasLeft && hasRight) || (hasTop && hasBottom)) continue;

        // Check neighbors - if adjacent to stroke AND no wall between, add to stroke
        const neighbors = [
          { nx: x - 1, ny: y, dir: "left", revDir: "right" },
          { nx: x + 1, ny: y, dir: "right", revDir: "left" },
          { nx: x, ny: y - 1, dir: "top", revDir: "bottom" },
          { nx: x, ny: y + 1, dir: "bottom", revDir: "top" },
        ];

        for (const { nx, ny, dir, revDir } of neighbors) {
          const nKey = `${nx},${ny}`;
          if (enclosedCorridors.has(nKey)) {
            // Neighbor is a stroke - check if no wall between
            if (!hasWall(fixedWalls, x, y, dir) && !hasWall(fixedWalls, nx, ny, revDir)) {
              enclosedCorridors.add(key);
              changed = true;
              break;
            }
          }
        }
      }
    }
  }

  // Outside = reachable cells that are NOT strokes
  const outsideCells = new Set();
  for (const key of reachable) {
    if (!enclosedCorridors.has(key)) {
      outsideCells.add(key);
    }
  }


  return {
    fixedWalls,
    potentialStroke,
    connectedStroke,
    outsideCells,
    enclosedCorridors,
    reachable,
  };
}