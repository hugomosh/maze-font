import React, { useMemo } from "react";
import fontData from "../assets/maze-font.json";

const UNIT_SIZE = 20;
const CHAR_CONTENT_WIDTH = 8;
const CHAR_CONTENT_HEIGHT = 14;
const CHAR_PADDING_UNITS = 1;
const CHAR_CELL_WIDTH_UNITS = CHAR_CONTENT_WIDTH + CHAR_PADDING_UNITS * 2;
const CHAR_CELL_HEIGHT_UNITS = CHAR_CONTENT_HEIGHT + CHAR_PADDING_UNITS * 2;

// Test component to visualize stroke detection for a single character
const StrokeTest = ({ char = "N" }) => {
  const gridWidth = CHAR_CELL_WIDTH_UNITS;
  const gridHeight = CHAR_CELL_HEIGHT_UNITS;

  const {
    fixedWalls,
    potentialStroke,
    connectedStroke,
    outsideCells,
    enclosedCorridors,
  } = useMemo(() => {
    const charData = fontData[char.toUpperCase()];
    if (!charData)
      return {
        fixedWalls: new Map(),
        potentialStroke: new Set(),
        connectedStroke: new Set(),
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
    for (let dy = 1; dy < CHAR_CELL_HEIGHT_UNITS - 1; dy++) {
      for (let dx = 1; dx < CHAR_CELL_WIDTH_UNITS - 1; dx++) {
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

    // Helper functions for stroke detection
    const hasWall = (x, y, dir) => {
      const fixed = fixedWalls.get(`${x},${y}`);
      return fixed && fixed[dir];
    };

    const isVerticalCorridor = (x, y) =>
      hasWall(x, y, "left") && hasWall(x + 1, y, "right");
    const isHorizontalCorridor = (x, y) =>
      hasWall(x, y, "top") && hasWall(x, y + 1, "bottom");

    // Find potential stroke cells
    const potentialStroke = new Set();
    for (const key of reachable) {
      if (!contentAreaCells.has(key)) continue;
      const [x, y] = key.split(",").map(Number);

      if (
        hasWall(x, y, "left") &&
        contentAreaCells.has(`${x + 1},${y}`) &&
        hasWall(x + 1, y, "right")
      ) {
        const extendsUp = isVerticalCorridor(x, y - 1);
        const extendsDown = isVerticalCorridor(x, y + 1);
        const connectsHorizontal =
          isHorizontalCorridor(x, y) ||
          isHorizontalCorridor(x, y - 1) ||
          isHorizontalCorridor(x + 1, y) ||
          isHorizontalCorridor(x + 1, y - 1);
        if (extendsUp || extendsDown || connectsHorizontal)
          potentialStroke.add(key);
      }

      if (
        hasWall(x, y, "right") &&
        contentAreaCells.has(`${x - 1},${y}`) &&
        hasWall(x - 1, y, "left")
      ) {
        const extendsUp = isVerticalCorridor(x - 1, y - 1);
        const extendsDown = isVerticalCorridor(x - 1, y + 1);
        const connectsHorizontal =
          isHorizontalCorridor(x - 1, y) ||
          isHorizontalCorridor(x - 1, y - 1) ||
          isHorizontalCorridor(x, y) ||
          isHorizontalCorridor(x, y - 1);
        if (extendsUp || extendsDown || connectsHorizontal)
          potentialStroke.add(key);
      }

      if (
        hasWall(x, y, "top") &&
        contentAreaCells.has(`${x},${y + 1}`) &&
        hasWall(x, y + 1, "bottom")
      ) {
        const extendsLeft = isHorizontalCorridor(x - 1, y);
        const extendsRight = isHorizontalCorridor(x + 1, y);
        const connectsVertical =
          isVerticalCorridor(x, y) ||
          isVerticalCorridor(x - 1, y) ||
          isVerticalCorridor(x, y + 1) ||
          isVerticalCorridor(x - 1, y + 1);
        if (extendsLeft || extendsRight || connectsVertical)
          potentialStroke.add(key);
      }

      if (
        hasWall(x, y, "bottom") &&
        contentAreaCells.has(`${x},${y - 1}`) &&
        hasWall(x, y - 1, "top")
      ) {
        const extendsLeft = isHorizontalCorridor(x - 1, y - 1);
        const extendsRight = isHorizontalCorridor(x + 1, y - 1);
        const connectsVertical =
          isVerticalCorridor(x, y - 1) ||
          isVerticalCorridor(x - 1, y - 1) ||
          isVerticalCorridor(x, y) ||
          isVerticalCorridor(x - 1, y);
        if (extendsLeft || extendsRight || connectsVertical)
          potentialStroke.add(key);
      }
    }

    // Filter: flood fill from padding through non-stroke cells to find "outside" cells
    // Then only keep stroke cells adjacent to "outside" cells
    const outsideCells = new Set();
    const outsideQueue = [];

    // Start from padding cells (non-content area)
    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        if (!contentAreaCells.has(`${x},${y}`)) {
          outsideQueue.push(`${x},${y}`);
        }
      }
    }

    // Flood fill through reachable non-stroke cells
    while (outsideQueue.length > 0) {
      const key = outsideQueue.shift();
      if (outsideCells.has(key)) continue;

      const [x, y] = key.split(",").map(Number);
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) continue;
      if (!reachable.has(key)) continue;
      if (potentialStroke.has(key)) continue; // Don't go through stroke

      outsideCells.add(key);

      // Check neighbors (only if no wall blocks)
      const neighbors = [
        { nx: x - 1, ny: y, dir: "left", revDir: "right" },
        { nx: x + 1, ny: y, dir: "right", revDir: "left" },
        { nx: x, ny: y - 1, dir: "top", revDir: "bottom" },
        { nx: x, ny: y + 1, dir: "bottom", revDir: "top" },
      ];

      for (const { nx, ny, dir, revDir } of neighbors) {
        const nKey = `${nx},${ny}`;
        if (
          !outsideCells.has(nKey) &&
          canMove(x, y, dir) &&
          canMove(nx, ny, revDir)
        ) {
          outsideQueue.push(nKey);
        }
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
        if (hasWall(x, y, "left") && hasWall(x + 1, y, "right")) {
          enclosedCorridors.add(key);
          enclosedCorridors.add(`${x + 1},${y}`);
        }
        // Horizontal corridor pattern
        if (hasWall(x, y, "top") && hasWall(x, y + 1, "bottom")) {
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
  }, [char]);

  const width = gridWidth * UNIT_SIZE;
  const height = gridHeight * UNIT_SIZE;

  return (
    <div style={{ padding: 20 }}>
      <h2>Stroke Test: "{char}"</h2>
      <p style={{ fontSize: 10 }}>
        <span style={{ background: "rgba(0,255,0,0.3)", padding: "2px 4px" }}>
          Green
        </span>
        =outside |
        <span
          style={{
            background: "rgba(0,100,255,0.3)",
            padding: "2px 4px",
            marginLeft: 3,
          }}
        >
          Blue
        </span>
        =hole |
        <span
          style={{
            background: "rgba(200,0,255,0.4)",
            padding: "2px 4px",
            marginLeft: 3,
          }}
        >
          Purple
        </span>
        =enclosed corridor |
        <span
          style={{
            background: "rgba(255,255,0,0.5)",
            padding: "2px 4px",
            marginLeft: 3,
          }}
        >
          Yellow
        </span>
        =filtered |
        <span
          style={{
            background: "rgba(255,100,0,0.6)",
            padding: "2px 4px",
            marginLeft: 3,
          }}
        >
          Orange
        </span>
        =stroke
      </p>

      <svg width={width} height={height} style={{ border: "1px solid #ccc" }}>
        {/* Grid */}
        {Array.from({ length: gridHeight }, (_, y) =>
          Array.from({ length: gridWidth }, (_, x) => {
            const key = `${x},${y}`;
            const isPotential = potentialStroke.has(key);
            const isConnected = connectedStroke.has(key);
            const isContent =
              x >= 1 && x < gridWidth - 1 && y >= 1 && y < gridHeight - 1;

            const isOutside = outsideCells.has(key);
            const isEnclosedCorridor = enclosedCorridors.has(key);
            const isEnclosed =
              isContent && !isOutside && !isPotential && !isEnclosedCorridor;

            let fill = isContent ? "#f0f0f0" : "#e0e0e0";
            if (isOutside && isContent) fill = "rgba(0, 255, 0, 0.2)"; // Green = outside (maze area)
            if (isEnclosed) fill = "rgba(0, 100, 255, 0.3)"; // Blue = enclosed hole (maze)
            if (isEnclosedCorridor) fill = "rgba(200, 0, 255, 0.4)"; // Purple = enclosed corridor (center wall)
            if (isPotential && !isConnected) fill = "rgba(255, 255, 0, 0.5)"; // Yellow = potential but filtered out
            if (isConnected) fill = "rgba(255, 100, 0, 0.6)"; // Orange = connected stroke (kept empty)

            return (
              <rect
                key={key}
                x={x * UNIT_SIZE}
                y={y * UNIT_SIZE}
                width={UNIT_SIZE}
                height={UNIT_SIZE}
                fill={fill}
                stroke="#ddd"
                strokeWidth="0.5"
              />
            );
          }),
        )}

        {/* Font walls */}
        {fontData[char.toUpperCase()]?.map((wall, i) => {
          const [x1, y1, x2, y2] = wall;
          return (
            <line
              key={i}
              x1={x1 * UNIT_SIZE}
              y1={y1 * UNIT_SIZE}
              x2={x2 * UNIT_SIZE}
              y2={y2 * UNIT_SIZE}
              stroke="#000"
              strokeWidth="2"
              strokeLinecap="square"
            />
          );
        })}
        {/* Cell coordinates */}
        {Array.from({ length: gridHeight }, (_, y) =>
          Array.from({ length: gridWidth }, (_, x) => (
            <text
              key={`coord-${x}-${y}`}
              x={x * UNIT_SIZE + UNIT_SIZE / 2}
              y={y * UNIT_SIZE + UNIT_SIZE / 2}
              fontSize="8"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#666"
            >
              {x},{y}
            </text>
          )),
        )}
      </svg>

      <div style={{ marginTop: 10 }}>
        <strong>Potential stroke cells:</strong> {potentialStroke.size}
        <br />
        <strong>Connected stroke cells:</strong> {connectedStroke.size}
        <br />
        <strong>Problem cells (should NOT be orange):</strong>
        <span style={{ color: "red" }}>
          {" "}
          Check for orange cells in enclosed areas
        </span>
      </div>
    </div>
  );
};

export default StrokeTest;
