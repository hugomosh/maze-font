// src/lib/mazeGenerator.js

const recursiveBacktracker = (grid, startCell, blockedCells) => {
  const stack = [];
  stack.push(startCell);
  startCell.visited = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1]; // Peek at the top of the stack

    const neighbors = [];
    const { x, y } = current;

    // Get potential neighbors (top, right, bottom, left)
    const top = y > 0 ? grid[y - 1][x] : null;
    const right = x < grid[0].length - 1 ? grid[y][x + 1] : null;
    const bottom = y < grid.length - 1 ? grid[y + 1][x] : null;
    const left = x > 0 ? grid[y][x - 1] : null;

    if (top && !top.visited && !blockedCells.has(`${x},${y-1}`)) neighbors.push(top);
    if (right && !right.visited && !blockedCells.has(`${x+1},${y}`)) neighbors.push(right);
    if (bottom && !bottom.visited && !blockedCells.has(`${x},${y+1}`)) neighbors.push(bottom);
    if (left && !left.visited && !blockedCells.has(`${x-1},${y}`)) neighbors.push(left);

    if (neighbors.length > 0) {
      const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
      chosen.visited = true;

      // Remove walls between current and chosen
      if (chosen.y < current.y) { // Top
        current.walls.top = false;
        chosen.walls.bottom = false;
      } else if (chosen.x > current.x) { // Right
        current.walls.right = false;
        chosen.walls.left = false;
      } else if (chosen.y > current.y) { // Bottom
        current.walls.bottom = false;
        chosen.walls.top = false;
      } else if (chosen.x < current.x) { // Left
        current.walls.left = false;
        chosen.walls.right = false;
      }
      
      stack.push(chosen);
    } else {
      stack.pop(); // Backtrack
    }
  }

  return grid;
};

const algorithms = {
  'recursive-backtracker': recursiveBacktracker,
};

export function generateMaze(width, height, blockedCells, algorithm = 'recursive-backtracker') {
  // 1. Create the grid data structure
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({
        x,
        y,
        visited: false,
        walls: { top: true, right: true, bottom: true, left: true },
      });
    }
    grid.push(row);
  }

  // 2. Find a valid starting cell that is not blocked
  let startCell = null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!blockedCells.has(`${x},${y}`)) {
        startCell = grid[y][x];
        break;
      }
    }
    if (startCell) break;
  }
  
  if (!startCell) return []; // No place to start, return empty maze

  // 3. Run the chosen algorithm
  const mazeGrid = algorithms[algorithm](grid, startCell, blockedCells);

  // 4. Convert grid data to a list of wall segments to draw
  const walls = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = mazeGrid[y][x];
      // Don't draw walls for blocked cells
      if (blockedCells.has(`${x},${y}`)) continue;

      if (cell.walls.top) walls.push([x, y, x + 1, y]);
      if (cell.walls.right) walls.push([x + 1, y, x + 1, y + 1]);
      if (cell.walls.bottom) walls.push([x, y + 1, x + 1, y + 1]);
      if (cell.walls.left) walls.push([x, y, x, y + 1]);
    }
  }

  return walls;
}
