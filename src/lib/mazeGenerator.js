// fixedWalls: Map where key is "x,y" and value is { top, right, bottom, left } booleans
// indicating which walls are fixed and shouldn't be removed
// verticalBias: how many times more likely vertical neighbors (top/bottom) are chosen (default 1 = uniform)
export function recursiveBacktracker(grid, startCell, fixedWalls = new Map(), verticalBias = 1) {
  if (!startCell) return grid;

  const stack = [];
  stack.push(startCell);
  startCell.visited = true;

  // Helper to check if a wall is fixed
  const isWallFixed = (x, y, dir) => {
    const fixed = fixedWalls.get(`${x},${y}`);
    return fixed ? fixed[dir] : false;
  };

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const { x, y } = current;

    const neighbors = [];
    const top = y > 0 ? grid[y - 1][x] : null;
    const right = x < grid[0].length - 1 ? grid[y][x + 1] : null;
    const bottom = y < grid.length - 1 ? grid[y + 1][x] : null;
    const left = x > 0 ? grid[y][x - 1] : null;

    // Only add neighbors if not visited AND the wall between isn't fixed
    if (top && !top.visited && !isWallFixed(x, y, 'top') && !isWallFixed(x, y - 1, 'bottom')) {
      neighbors.push({ cell: top, dir: 'top' });
    }
    if (right && !right.visited && !isWallFixed(x, y, 'right') && !isWallFixed(x + 1, y, 'left')) {
      neighbors.push({ cell: right, dir: 'right' });
    }
    if (bottom && !bottom.visited && !isWallFixed(x, y, 'bottom') && !isWallFixed(x, y + 1, 'top')) {
      neighbors.push({ cell: bottom, dir: 'bottom' });
    }
    if (left && !left.visited && !isWallFixed(x, y, 'left') && !isWallFixed(x - 1, y, 'right')) {
      neighbors.push({ cell: left, dir: 'left' });
    }

    if (neighbors.length > 0) {
      // Weight vertical neighbors (top/bottom) by verticalBias
      const weighted = [];
      for (const n of neighbors) {
        const count = (n.dir === 'top' || n.dir === 'bottom') ? verticalBias : 1;
        for (let i = 0; i < count; i++) weighted.push(n);
      }
      const { cell: chosen, dir } = weighted[Math.floor(Math.random() * weighted.length)];
      chosen.visited = true;

      if (dir === 'top') { current.walls.top = false; chosen.walls.bottom = false; }
      else if (dir === 'right') { current.walls.right = false; chosen.walls.left = false; }
      else if (dir === 'bottom') { current.walls.bottom = false; chosen.walls.top = false; }
      else if (dir === 'left') { current.walls.left = false; chosen.walls.right = false; }

      stack.push(chosen);
    } else {
      stack.pop();
    }
  }

  return grid;
}
