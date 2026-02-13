# Maze Font Generation Rules

## Overview

The maze font system generates a maze that incorporates letter shapes. Each letter is defined by **font walls** that form 2-cell-wide corridors. The goal is to create a solvable maze where the solution path goes through the letters.

## Cell Types

| Color in Test | Type | Description | Maze Behavior |
|---------------|------|-------------|---------------|
| Gray (padding) | Padding | 1-cell border around each character | Normal maze generation |
| Green | Outside | Content area cells reachable from padding without crossing stroke | Normal maze generation |
| Blue | Enclosed | Content area cells surrounded by stroke (e.g., inside O, between # bars) | Maze with center wall (see Rule 6) |
| Yellow | Filtered Stroke | Detected as corridor but filtered out | Normal maze generation |
| Orange | Connected Stroke | Actual letter path | Left empty (no maze walls) |

## Rules

### Rule 1: Font Walls Define Letter Shape
- Each letter is defined by wall segments in `maze-font.json`
- Wall segments are lines `[x1, y1, x2, y2]` in a 9x13 coordinate system
- These walls are **fixed** and cannot be removed by the maze generator

### Rule 2: Letter Corridors Are 2 Cells Wide
- All letter strokes (paths through the letter) are exactly 2 cells wide
- A vertical corridor has walls on the left and right
- A horizontal corridor has walls on the top and bottom

### Rule 3: Stroke Detection (Potential Stroke)
A cell is **potential stroke** if:
- It's in the content area (not padding)
- It's reachable from the grid edge (via flood fill respecting font walls)
- It's part of a 2-cell-wide corridor:
  - Has wall on left AND neighbor to right has wall on right, OR
  - Has wall on right AND neighbor to left has wall on left, OR
  - Has wall on top AND neighbor below has wall on bottom, OR
  - Has wall on bottom AND neighbor above has wall on top
- The corridor extends (at least 3 cells) OR connects to a perpendicular corridor

### Rule 4: Connected Stroke (Actual Letter Path)
A potential stroke cell is **connected stroke** if:
1. It's adjacent to an "outside" cell (green), OR
2. It's connected to another connected stroke cell (no font wall between)

The "outside" cells are found by flood filling from the padding area, stopping at potential stroke cells.

### Rule 5: Stroke Cells Are Left Empty
- Connected stroke cells have all non-font walls removed
- This creates clear corridors through the letter
- The maze can flow through these corridors

### Rule 6: Enclosed Corridors Get Center Wall
- Enclosed areas (blue) that are 2 cells wide should have a wall down the center
- For a vertical enclosed corridor: `O | I | I | O`
  - O = outside cell
  - | = maze wall
  - I = interior/enclosed cell
- This ensures you can't walk straight through enclosed areas

### Rule 7: Holes Inside Letters Get Maze
- Some letters have enclosed holes (e.g., inside O, 8, 6, 9, @)
- These holes are NOT reachable from the outside (via flood fill)
- The maze generator creates maze structure inside these holes
- This fills the visual space while keeping the letter shape

### Rule 8: Maze Touches Exterior Letter Walls
- The maze should connect to the outer walls of letters
- Padding cells are NOT blocked - maze fills them
- Only content area cells can be stroke

## Visual Example

```
Character Grid (10x14 with 1-cell padding):

  0 1 2 3 4 5 6 7 8 9
0 P P P P P P P P P P    P = Padding (gray)
1 P . . . . . . . . P    . = Content area
2 P . S S . . S S . P    S = Stroke (orange)
3 P . S S . . S S . P    E = Enclosed (blue)
4 P . S S E E S S . P    G = Outside/Green
5 P . S S E E S S . P
...
```

## Problem Cases

Letters that need special attention:
- **N, X, K**: Diagonal elements create triangular enclosed spaces
- **#, @**: Grid patterns with multiple enclosed rectangles
- **S**: Curved shape with potential enclosed areas
- **0, 8, O, 6, 9, B, Q, G**: Have interior holes that need maze

## Implementation Notes

1. Font walls are converted to cell wall flags (`fixedWalls` Map)
2. Reachability is computed via flood fill from grid edges
3. Stroke detection uses the 2-cell corridor pattern
4. Connected stroke is found via flood fill from "outside" cells
5. Maze generation skips stroke cells and respects fixed walls
6. Disconnected regions (holes) get separate maze generation passes