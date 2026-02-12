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

  // SIMPLIFIED UNIFIED FLOOD FILL ALGORITHM FOR STROKES
  // One flood fill catches everything: corridors, corners, intersections, dots

  const enclosedCorridors = new Set();
  const strokeQueue = [];

  // Helper: get wall count for a cell
  const getWallCount = (x, y) => {
    return (
      (hasWall(fixedWalls, x, y, "top") ? 1 : 0) +
      (hasWall(fixedWalls, x, y, "right") ? 1 : 0) +
      (hasWall(fixedWalls, x, y, "bottom") ? 1 : 0) +
      (hasWall(fixedWalls, x, y, "left") ? 1 : 0)
    );
  };

  // Helper: check if two cells are connected (no wall between)
  const isConnected = (x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 1) return !hasWall(fixedWalls, x1, y1, "right") && !hasWall(fixedWalls, x2, y2, "left");
    if (dx === -1) return !hasWall(fixedWalls, x1, y1, "left") && !hasWall(fixedWalls, x2, y2, "right");
    if (dy === 1) return !hasWall(fixedWalls, x1, y1, "bottom") && !hasWall(fixedWalls, x2, y2, "top");
    if (dy === -1) return !hasWall(fixedWalls, x1, y1, "top") && !hasWall(fixedWalls, x2, y2, "bottom");

    return false;
  };

  // STEP 1: Find seeds - high confidence strokes (3+ walls OR 2 opposite walls)
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const key = `${x},${y}`;
      if (!contentAreaCells.has(key)) continue;

      const wallCount = getWallCount(x, y);

      // 3+ walls = always stroke (intersections)
      if (wallCount >= 3) {
        enclosedCorridors.add(key);
        strokeQueue.push({ x, y });
        continue;
      }

      // 2 opposite walls = always stroke (corridors)
      if (wallCount === 2) {
        const hasLeft = hasWall(fixedWalls, x, y, "left");
        const hasRight = hasWall(fixedWalls, x, y, "right");
        const hasTop = hasWall(fixedWalls, x, y, "top");
        const hasBottom = hasWall(fixedWalls, x, y, "bottom");

        if ((hasLeft && hasRight) || (hasTop && hasBottom)) {
          enclosedCorridors.add(key);
          strokeQueue.push({ x, y });
        }
      }
    }
  }

  // STEP 2: Flood from seeds to connected corridors (2 opposite walls) and intersections (3+ walls)
  // Don't flood to corners (2 adjacent walls) yet - handle those separately
  while (strokeQueue.length > 0) {
    const { x, y } = strokeQueue.shift();

    // Check all 4 neighbors
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];

    for (const [nx, ny] of neighbors) {
      const nKey = `${nx},${ny}`;

      // Skip if not content or already processed
      if (!contentAreaCells.has(nKey)) continue;
      if (enclosedCorridors.has(nKey)) continue;

      const nWallCount = getWallCount(nx, ny);

      // Only flood to cells with 3+ walls or 2 opposite walls
      if (nWallCount >= 3 && isConnected(x, y, nx, ny)) {
        // 3+ walls = intersection
        enclosedCorridors.add(nKey);
        strokeQueue.push({ x: nx, y: ny });
      } else if (nWallCount === 2) {
        // Check if 2 opposite walls (corridor)
        const hasLeft = hasWall(fixedWalls, nx, ny, "left");
        const hasRight = hasWall(fixedWalls, nx, ny, "right");
        const hasTop = hasWall(fixedWalls, nx, ny, "top");
        const hasBottom = hasWall(fixedWalls, nx, ny, "bottom");

        if (((hasLeft && hasRight) || (hasTop && hasBottom)) && isConnected(x, y, nx, ny)) {
          // 2 opposite walls = corridor
          enclosedCorridors.add(nKey);
          strokeQueue.push({ x: nx, y: ny });
        }
      }
    }
  }

  // STEP 3: Separate pass for corners (2 adjacent walls)
  // Add corners that are connected to strokes (both reachable and unreachable)
  // This catches stroke corners while leaving isolated hole corners unmarked
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const key = `${x},${y}`;

        if (!contentAreaCells.has(key)) continue;
        if (enclosedCorridors.has(key)) continue;

        const wallCount = getWallCount(x, y);
        if (wallCount !== 2) continue; // Only interested in 2-wall cells

        // Check if 2 adjacent walls (corner)
        const hasLeft = hasWall(fixedWalls, x, y, "left");
        const hasRight = hasWall(fixedWalls, x, y, "right");
        const hasTop = hasWall(fixedWalls, x, y, "top");
        const hasBottom = hasWall(fixedWalls, x, y, "bottom");

        // Skip if opposite walls (already handled)
        if ((hasLeft && hasRight) || (hasTop && hasBottom)) continue;

        // This is a corner - check if connected to any stroke
        const neighbors = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (enclosedCorridors.has(`${nx},${ny}`) && isConnected(x, y, nx, ny)) {
            enclosedCorridors.add(key);
            changed = true;
            break;
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