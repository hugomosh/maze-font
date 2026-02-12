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

  // Find potential stroke cells
  const potentialStroke = new Set();
  for (const key of reachable) {
    if (!contentAreaCells.has(key)) continue;
    const [x, y] = key.split(",").map(Number);

    if (
      hasWall(fixedWalls, x, y, "left") &&
      contentAreaCells.has(`${x + 1},${y}`) &&
      hasWall(fixedWalls, x + 1, y, "right")
    ) {
      const extendsUp = isVerticalCorridor(fixedWalls, x, y - 1);
      const extendsDown = isVerticalCorridor(fixedWalls, x, y + 1);
      const connectsHorizontal =
        isHorizontalCorridor(fixedWalls, x, y) ||
        isHorizontalCorridor(fixedWalls, x, y - 1) ||
        isHorizontalCorridor(fixedWalls, x + 1, y) ||
        isHorizontalCorridor(fixedWalls, x + 1, y - 1);
      console.log(`Cell ${key} (left wall check): extendsUp=${extendsUp}, extendsDown=${extendsDown}, connectsHorizontal=${connectsHorizontal}`);
      if (
        (extendsUp && extendsDown && connectsHorizontal) || // Straight vertical AND connected horizontally
        (extendsUp && !extendsDown && connectsHorizontal) || // Extends up and connects horizontally (a bend)
        (!extendsUp && extendsDown && connectsHorizontal) || // Extends down and connects horizontally (a bend)
        (connectsHorizontal && !extendsUp && !extendsDown) // Only horizontal connection (a short bend)
      ) {
        potentialStroke.add(key);
      }
    }

    if (
      hasWall(fixedWalls, x, y, "right") &&
      contentAreaCells.has(`${x - 1},${y}`) &&
      hasWall(fixedWalls, x - 1, y, "left")
    ) {
      const extendsUp = isVerticalCorridor(fixedWalls, x - 1, y - 1);
      const extendsDown = isVerticalCorridor(fixedWalls, x - 1, y + 1);
      const connectsHorizontal =
        isHorizontalCorridor(fixedWalls, x - 1, y) ||
        isHorizontalCorridor(fixedWalls, x - 1, y - 1) ||
        isHorizontalCorridor(fixedWalls, x, y) ||
        isHorizontalCorridor(fixedWalls, x, y - 1);
      console.log(`Cell ${key} (right wall check): extendsUp=${extendsUp}, extendsDown=${extendsDown}, connectsHorizontal=${connectsHorizontal}`);
      if (
        (extendsUp && extendsDown && connectsHorizontal) || // Straight vertical AND connected horizontally
        (extendsUp && !extendsDown && connectsHorizontal) || // Extends up and connects horizontally (a bend)
        (!extendsUp && extendsDown && connectsHorizontal) || // Extends down and connects horizontally (a bend)
        (connectsHorizontal && !extendsUp && !extendsDown) // Only horizontal connection (a short bend)
      ) {
        potentialStroke.add(key);
      }
    }

    if (
      hasWall(fixedWalls, x, y, "top") &&
      contentAreaCells.has(`${x},${y + 1}`) &&
      hasWall(fixedWalls, x, y + 1, "bottom")
    ) {
      const extendsLeft = isHorizontalCorridor(fixedWalls, x - 1, y);
      const extendsRight = isHorizontalCorridor(fixedWalls, x + 1, y);
      const connectsVertical =
        isVerticalCorridor(fixedWalls, x, y) ||
        isVerticalCorridor(fixedWalls, x - 1, y) ||
        isVerticalCorridor(fixedWalls, x, y + 1) ||
        isVerticalCorridor(fixedWalls, x - 1, y + 1);
      console.log(`Cell ${key} (top wall check): extendsLeft=${extendsLeft}, extendsRight=${extendsRight}, connectsVertical=${connectsVertical}`);
      if (
        (extendsLeft && extendsRight && connectsVertical) || // Straight horizontal AND connected vertically
        (extendsLeft && !extendsRight && connectsVertical) || // Extends left and connects vertically (a bend)
        (!extendsLeft && extendsRight && connectsVertical) || // Extends right and connects vertically (a bend)
        (connectsVertical && !extendsLeft && !extendsRight) // Only vertical connection (a short bend)
      ) {
        potentialStroke.add(key);
      }
    }

    if (
      hasWall(fixedWalls, x, y, "bottom") &&
      contentAreaCells.has(`${x},${y - 1}`) &&
      hasWall(fixedWalls, x, y - 1, "top")
    ) {
      const extendsLeft = isHorizontalCorridor(fixedWalls, x - 1, y - 1);
      const extendsRight = isHorizontalCorridor(fixedWalls, x + 1, y - 1);
      const connectsVertical =
        isVerticalCorridor(fixedWalls, x, y - 1) ||
        isVerticalCorridor(fixedWalls, x - 1, y - 1) ||
        isVerticalCorridor(fixedWalls, x, y) ||
        isVerticalCorridor(fixedWalls, x - 1, y);
      console.log(`Cell ${key} (bottom wall check): extendsLeft=${extendsLeft}, extendsRight=${extendsRight}, connectsVertical=${connectsVertical}`);
      if (
        (extendsLeft && extendsRight && connectsVertical) || // Straight horizontal AND connected vertically
        (extendsLeft && !extendsRight && connectsVertical) || // Extends left and connects vertically (a bend)
        (!extendsLeft && extendsRight && connectsVertical) || // Extends right and connects vertically (a bend)
        (connectsVertical && !extendsLeft && !extendsRight) // Only vertical connection (a short bend)
      ) {
        potentialStroke.add(key);
      }
    }
  }

  // Simplified: All reachable cells that are not potential strokes are "outside"
  const outsideCells = new Set();
  for (const key of reachable) {
    if (!potentialStroke.has(key)) {
      outsideCells.add(key);
    }
  }

  // Now find stroke cells adjacent to outside cells
  const connectedStroke = new Set();
  for (const key of potentialStroke) {
    const [x, y] = key.split(",").map(Number);
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (outsideCells.has(`${nx},${ny}`)) {
        connectedStroke.add(key);
        break;
      }
    }
  }

  // Expand: stroke cells adjacent to connected stroke are also connected (if no wall between)
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of potentialStroke) {
      if (connectedStroke.has(key)) continue;
      const [x, y] = key.split(",").map(Number);
      const neighbors = [
        { nx: x - 1, ny: y, dir: "left", revDir: "right" },
        { nx: x + 1, ny: y, dir: "right", revDir: "left" },
        { nx: x, ny: y - 1, dir: "top", revDir: "bottom" },
        { nx: x, ny: y + 1, dir: "bottom", revDir: "top" },
      ];

      for (const { nx, ny, dir, revDir } of neighbors) {
        const nKey = `${nx},${ny}`;
        if (
          connectedStroke.has(nKey) &&
          canMove(x, y, dir) &&
          canMove(nx, ny, revDir)
        ) {
          connectedStroke.add(key);
          changed = true;
          break;
        }
      }
    }
  }

  // Find enclosed corridors (2-cell-wide areas bounded by walls, not connected to outside)
  const enclosedCorridors = new Set();
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const key = `${x},${y}`;
      if (!contentAreaCells.has(key)) continue;
      if (outsideCells.has(key)) continue;
      if (potentialStroke.has(key)) continue;
      if (!reachable.has(key)) continue;

      // Vertical corridor pattern
      if (hasWall(fixedWalls, x, y, "left") && hasWall(fixedWalls, x + 1, y, "right")) {
        enclosedCorridors.add(key);
        enclosedCorridors.add(`${x + 1},${y}`);
      }
      // Horizontal corridor pattern
      if (hasWall(fixedWalls, x, y, "top") && hasWall(fixedWalls, x, y + 1, "bottom")) {
        enclosedCorridors.add(key);
        enclosedCorridors.add(`${x},${y + 1}`);
      }
    }
  }


  return {
    fixedWalls,
    potentialStroke,
    connectedStroke,
    outsideCells,
    enclosedCorridors,
  };
}