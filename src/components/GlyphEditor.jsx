import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  CELL_SIZE, GRID_WIDTH, GRID_HEIGHT, 
  CHAR_CONTENT_WIDTH, CHAR_CONTENT_HEIGHT, CHAR_PADDING_UNITS,
  DIAMOND_COLOR, AXIS_COLOR, WALL_COLOR, 
  isDiamondNode, serializeWall, wallsToStrokeDetectorFormat
} from '../lib/editorConstants';
import { detectStrokes } from '../lib/strokeDetector';
import './GlyphEditor.css';

/**
 * @typedef {import('../lib/types').Glyph} Glyph
 * @typedef {import('../lib/types').Wall} Wall
 * @typedef {import('../lib/types').Point} Point
 */

/**
 * @typedef {'none' | 'horizontal' | 'vertical'} WallState
 */

/**
 * @param {{glyph: Glyph, onUpdate: (walls: Wall[]) => void}} props
 */
const GlyphEditor = ({ glyph, onUpdate, onEditEnd, char, fontData }) => {
  const canvasRef = useRef(null);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [isPainting, setIsPainting] = useState(false);
  const [paintToState, setPaintToState] = useState(null);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ') {
        setIsMoveMode(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === ' ') {
        setIsMoveMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const getCellState = (cell, walls) => {
    const hWall = serializeWall({ p1: { x: cell.x - 1, y: cell.y }, p2: { x: cell.x + 1, y: cell.y } });
    const vWall = serializeWall({ p1: { x: cell.x, y: cell.y - 1 }, p2: { x: cell.x, y: cell.y + 1 } });
    
    const wallSet = new Set(walls.map(serializeWall));

    if (wallSet.has(hWall)) return 'horizontal';
    if (wallSet.has(vWall)) return 'vertical';
    return 'none';
  };

  const setCellState = (cell, state, currentWalls) => {
    const hWallObj = { p1: { x: cell.x - 1, y: cell.y }, p2: { x: cell.x + 1, y: cell.y } };
    const vWallObj = { p1: { x: cell.x, y: cell.y - 1 }, p2: { x: cell.x, y: cell.y + 1 } };
    const hWall = serializeWall(hWallObj);
    const vWall = serializeWall(vWallObj);
    
    let nextWalls = currentWalls.filter(w => {
      const s = serializeWall(w);
      return s !== hWall && s !== vWall;
    });

    if (state === 'horizontal') {
      nextWalls.push(hWallObj);
    } else if (state === 'vertical') {
      nextWalls.push(vWallObj);
    }
    return nextWalls;
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Stroke detection calculations
    const wallsForDetection = wallsToStrokeDetectorFormat(glyph.walls);
    const {
      fixedWalls,
      potentialStroke,
      connectedStroke,
      outsideCells,
      enclosedCorridors,
    } = detectStrokes(char, { [char]: wallsForDetection }, GRID_WIDTH, GRID_HEIGHT);

    // Background coloring based on stroke detection
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const key = `${x},${y}`;
        const isContent =
          x >= CHAR_PADDING_UNITS && x < GRID_WIDTH - CHAR_PADDING_UNITS &&
          y >= CHAR_PADDING_UNITS && y < GRID_HEIGHT - CHAR_PADDING_UNITS;

        const isOutside = outsideCells.has(key);
        const isEnclosedCorridor = enclosedCorridors.has(key);
        const isPotential = potentialStroke.has(key);
        const isConnected = connectedStroke.has(key);
        const isHole =
          isContent && !isOutside && !isPotential && !isEnclosedCorridor;

        let fill = 'transparent';
        if (isOutside && isContent) fill = "rgba(0, 255, 0, 0.1)"; // Green = outside (maze area)
        if (isHole) fill = "rgba(0, 100, 255, 0.1)"; // Blue = enclosed hole (maze)
        if (isEnclosedCorridor) fill = "rgba(200, 0, 255, 0.1)"; // Purple = enclosed corridor (center wall)
        if (isPotential && !isConnected) fill = "rgba(255, 255, 0, 0.1)"; // Yellow = potential but filtered out
        if (isConnected) fill = "rgba(255, 100, 0, 0.1)"; // Orange = connected stroke (kept empty)

        if (fill !== 'transparent') {
          ctx.fillStyle = fill;
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
    
    // Background Grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_WIDTH; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL_SIZE, 0); ctx.lineTo(x * CELL_SIZE, GRID_HEIGHT * CELL_SIZE); ctx.stroke();
    }
    for (let y = 0; y <= GRID_HEIGHT; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL_SIZE); ctx.lineTo(GRID_WIDTH * CELL_SIZE, y * CELL_SIZE); ctx.stroke();
    }

    // Diamond Grid Guides
    ctx.strokeStyle = DIAMOND_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = -GRID_HEIGHT; i <= GRID_WIDTH + GRID_HEIGHT; i += 2) {
      ctx.beginPath();
      ctx.moveTo(Math.max(0, -i) * CELL_SIZE, Math.max(0, i) * CELL_SIZE);
      ctx.lineTo(Math.min(GRID_WIDTH, GRID_HEIGHT - i) * CELL_SIZE, Math.min(GRID_HEIGHT, GRID_WIDTH + i) * CELL_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(Math.max(0, i - GRID_HEIGHT) * CELL_SIZE, Math.min(GRID_HEIGHT, i) * CELL_SIZE);
      ctx.lineTo(Math.min(GRID_WIDTH, i) * CELL_SIZE, Math.max(0, i - GRID_WIDTH) * CELL_SIZE);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Nodes
    for (let x = 0; x <= GRID_WIDTH; x++) {
      for (let y = 0; y <= GRID_HEIGHT; y++) {
        if (isDiamondNode(x, y)) {
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath(); ctx.arc(x * CELL_SIZE, y * CELL_SIZE, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Hover Cell Highlight
    if (hoveredCell) {
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(hoveredCell.x * CELL_SIZE, (hoveredCell.y - 1) * CELL_SIZE);
      ctx.lineTo((hoveredCell.x + 1) * CELL_SIZE, hoveredCell.y * CELL_SIZE);
      ctx.lineTo(hoveredCell.x * CELL_SIZE, (hoveredCell.y + 1) * CELL_SIZE);
      ctx.lineTo((hoveredCell.x - 1) * CELL_SIZE, hoveredCell.y * CELL_SIZE);
      ctx.closePath();
      ctx.fill();

      const currentState = getCellState(hoveredCell, glyph.walls);
      const nextMap = { 'none': 'horizontal', 'horizontal': 'vertical', 'vertical': 'none' };
      const nextState = nextMap[currentState];
      
      ctx.lineWidth = 4;
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = nextState === 'none' ? '#ef4444' : AXIS_COLOR;
      ctx.globalAlpha = 0.4;
      if (nextState === 'horizontal') {
        ctx.beginPath(); ctx.moveTo((hoveredCell.x - 1) * CELL_SIZE, hoveredCell.y * CELL_SIZE); ctx.lineTo((hoveredCell.x + 1) * CELL_SIZE, hoveredCell.y * CELL_SIZE); ctx.stroke();
      } else if (nextState === 'vertical') {
        ctx.beginPath(); ctx.moveTo(hoveredCell.x * CELL_SIZE, (hoveredCell.y - 1) * CELL_SIZE); ctx.lineTo(hoveredCell.x * CELL_SIZE, (hoveredCell.y + 1) * CELL_SIZE); ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
      ctx.setLineDash([]);
    }

    // Existing Walls
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    glyph.walls.forEach(wall => {
      ctx.beginPath();
      ctx.moveTo(wall.p1.x * CELL_SIZE, wall.p1.y * CELL_SIZE);
      ctx.lineTo(wall.p2.x * CELL_SIZE, wall.p2.y * CELL_SIZE);
      ctx.stroke();
    });

    // Cell coordinates
    ctx.fillStyle = '#666';
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        ctx.fillText(`${x},${y}`, x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
      }
    }
  }, [glyph, hoveredCell, char]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const getCellAtCoords = (mouseX, mouseY) => {
    const gx = mouseX / CELL_SIZE;
    const gy = mouseY / CELL_SIZE;
    
    // Centers of diamonds are points (x,y) where x+y is ODD.
    const candidates = [
        { x: Math.floor(gx), y: Math.floor(gy) },
        { x: Math.ceil(gx), y: Math.floor(gy) },
        { x: Math.floor(gx), y: Math.ceil(gy) },
        { x: Math.ceil(gx), y: Math.ceil(gy) }
    ].filter(p => (p.x + p.y) % 2 !== 0);

    let best = null;
    let minDist = 0.85;
    candidates.forEach(p => {
        const d = Math.sqrt(Math.pow(gx - p.x, 2) + Math.pow(gy - p.y, 2));
        if (d < minDist) {
            minDist = d;
            best = p;
        }
    });

    if (best && best.x > 0 && best.x < GRID_WIDTH && best.y > 0 && best.y < GRID_HEIGHT) {
      return best;
    }
    return null;
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isMoveMode && isPainting && dragStart) {
      const dx = Math.round((mouseX - dragStart.x) / CELL_SIZE);
      const dy = Math.round((mouseY - dragStart.y) / CELL_SIZE);

      const newWalls = dragStart.originalWalls.map(wall => ({
        p1: { x: wall.p1.x + dx, y: wall.p1.y + dy },
        p2: { x: wall.p2.x + dx, y: wall.p2.y + dy },
      }));
      onUpdate(newWalls);
      return;
    }

    const cell = getCellAtCoords(mouseX, mouseY);
    setHoveredCell(cell);

    if (isPainting && cell && paintToState !== null) {
      const nextWalls = setCellState(cell, paintToState, glyph.walls);
      onUpdate(nextWalls);
    }
  };

  const handleMouseDown = (e) => {
    if (isMoveMode) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        originalWalls: glyph.walls,
      });
      setIsPainting(true);
      return;
    }

    if (!hoveredCell) return;
    const currentState = getCellState(hoveredCell, glyph.walls);
    const nextMap = { 'none': 'horizontal', 'horizontal': 'vertical', 'vertical': 'none' };
    const nextState = nextMap[currentState];
    
    setPaintToState(nextState);
    setIsPainting(true);
    
    const nextWalls = setCellState(hoveredCell, nextState, glyph.walls);
    onUpdate(nextWalls);
  };

  const handleMouseUp = () => {
    if (isPainting) {
      onEditEnd();
    }
    setIsPainting(false);
    setPaintToState(null);
    setDragStart(null);
  };

  return (
    <canvas
      ref={canvasRef}
      width={GRID_WIDTH * CELL_SIZE}
      height={GRID_HEIGHT * CELL_SIZE}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setHoveredCell(null); handleMouseUp(); }}
      style={{ cursor: isMoveMode ? 'grab' : 'crosshair' }}
    />
  );
};

export default GlyphEditor;
