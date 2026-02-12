import React, { useMemo } from "react";
import fontData from "../assets/maze-font.json";
import { detectStrokes } from "../lib/strokeDetector";

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
    return detectStrokes(char, fontData, gridWidth, gridHeight);
  }, [char, fontData, gridWidth, gridHeight]);

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