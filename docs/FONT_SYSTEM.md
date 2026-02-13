# Maze Font System Documentation

## Overview

The maze font system renders characters as 2-cell-wide strokes that can be used to generate mazes. Each character is defined by wall segments that create letter outlines with proper padding for maze generation.

## Font Definition (maze-font.json)

### Structure
```json
{
  "A": [[x1, y1, x2, y2], ...],
  "B": [[x1, y1, x2, y2], ...],
  ...
}
```

### Wall Segments
Each line segment `[x1, y1, x2, y2]` creates walls in the grid:

#### Vertical Walls (x1 = x2)
```
Wall from (x, y1) to (x, y2) creates:
- Right wall on cells at x-1 (for all y between y1 and y2)
- Left wall on cells at x (for all y between y1 and y2)
```

#### Horizontal Walls (y1 = y2)
```
Wall from (x1, y) to (x2, y) creates:
- Bottom wall on cells at y-1 (for all x between x1 and x2)
- Top wall on cells at y (for all x between x1 and x2)
```

### Design Principle
**The font line is the WALL between cells, not the cells themselves.**

The cells adjacent to font lines form the "stroke padding" - creating 2-cell-wide strokes with an internal wall (the font line) between them.

Example:
```
Cells (1,1), (2,1), (1,2), (2,2) with font line between them:
+---+---+
|1,1|2,1|
+---X---+  ← Font line (wall) at X
|1,2|2,2|
+---+---+

All 4 cells are stroke padding around the font line.
```

## Grid System

### Grid Structure
- **Total grid**: `CHAR_CELL_WIDTH_UNITS x CHAR_CELL_HEIGHT_UNITS` (10 x 16)
- **Content area**: Inner area excluding 1-cell padding on all sides (8 x 14)
- **Padding**: Border cells (x=0, x=9, y=0, y=15)

### Cell Types
- **Padding cells**: Outside content area (gray)
- **Content cells**: Inside content area, classified as:
  - Outside (green)
  - Strokes (purple)
  - Holes (blue)

## Stroke Detection Algorithm

### Core Principle
**Strokes are identified by wall patterns and connectivity, not by reachability.**

The algorithm uses a unified flood fill approach that works identically for both reachable and unreachable regions. This allows it to correctly classify:
- Letter stroke corridors and corners (purple)
- Dots and small strokes like in '.', ';', '%' (purple)
- Hole interiors like in '8', 'O', '0' (blue)
- Outside maze areas (green)

### Algorithm Steps

#### 1. Build Wall Map
Convert font line segments into cell walls (top, right, bottom, left) for each grid cell.

#### 2. Flood Fill - Find Reachable Cells
Starting from border cells, flood through all cells that don't have walls blocking movement.
- **Reachable cells** = can be reached from borders
- Used later to distinguish outside (green) from holes (blue)

#### 3. Seed High-Confidence Strokes
Identify cells that are **definitely** strokes based on wall patterns:

**Pattern 1: Intersections**
- **3+ walls** = always part of stroke
- These are junction points where strokes meet or turn

**Pattern 2: Corridors**
- **2 opposite walls** (left+right OR top+bottom) = corridor stroke
- These form the straight segments of letter strokes
- The internal wall between the 2-cell-wide corridor is the font line

Add all cells matching these patterns to the stroke set and queue them for propagation.

#### 4. Flood Propagate Strokes
From the seeded strokes, flood to adjacent cells that also match high-confidence patterns:
- Only propagate through cells with **no wall blocking connection**
- Only flood to cells with **3+ walls** OR **2 opposite walls**
- This spreads strokes through corridors and intersections

#### 5. Corner Propagation
Expand strokes to connected corner cells:
- If a cell has **2 adjacent walls** (corner pattern)
- AND is adjacent to a stroke cell
- AND has **no wall between** them
- → Mark as stroke

**Key insight**: This works uniformly for ALL regions (reachable and unreachable):
- **Stroke corners** connect to stroke corridors → marked as stroke ✓
- **Dot corners** connect to dot seeds (collapsed strokes) → marked as stroke ✓
- **Hole corners** have NO strokes to connect to → remain unmarked ✓
- **Outside corners** have NO strokes to connect to → remain unmarked ✓

Repeat until no more corners can be added.

### Stroke Patterns Detected

```
3+ walls (intersection):     2 opposite walls (corridor):
    +---+                         +---+
    | X |                         | | |
    +   +                         +   +
    |   |                         | | |
    +---+                         +---+
      X = stroke                    | = walls, space = stroke

Corner propagation (works everywhere):
+---+---+                    +---+---+
| C | S |  If S is stroke    | S | S |  C becomes stroke
+---+---+  and no wall   →   +---+---+  (connected)
            between C and S
C = corner (2 adjacent walls), S = stroke

Hole corners DON'T propagate:
+---+---+
| C | ? | No high-confidence  +---+---+
+---+---+ strokes in hole  → | C | ? | C stays unmarked
| ? | ? |                     +---+---+
+---+---+                     | ? | ? |
                              +---+---+
All cells in hole remain unmarked (blue)
```

## Cell Classification

After stroke detection, cells are classified as:

### 1. Outside (Green)
- **Reachable** from borders
- **NOT** a stroke
- Used for maze generation

### 2. Strokes (Purple)
- Cells with 3+ walls, OR
- Cells with 2 opposite walls, OR
- Corner cells connected to strokes
- These form the letter outline

### 3. Holes (Blue)
- **NOT reachable** from borders
- **NOT** a stroke
- Empty spaces inside letters (like in "O", "8", etc.)

## Example: Letter "N"

```
Grid coordinates (content area 1-8 x 1-14):

 1 2 3 4 5 6 7 8
1 S S O O O S S S  ← S = Stroke (purple)
2 S S O O O S S S  ← O = Outside (green)
3 S S O O O S S
4 S S O O O S S
...

Strokes:
- (1,1): Corner with 2 adjacent walls, connected to stroke
- (2,2): Corridor with 2 opposite walls
- (7,2): Corridor with 2 opposite walls

Outside:
- (3,3): Corner with 2 adjacent walls, NOT connected to strokes
- (4,12): Open area with 0-1 walls
```

## Example: Letter "8"

```
Has two holes in the middle that are correctly distinguished from strokes:

Strokes (purple):
- Form the outer and inner outlines of "8"
- (1,5), (1,6), (2,5), (2,6): Three-way intersection at left side
- Have high-confidence patterns (3+ walls or 2 opposite walls)
- Corner cells connected to these strokes

Holes (blue):
- Upper hole: cells around (3,3) - (6,4)
- Lower hole: cells around (3,7) - (6,10)
- NOT reachable from borders
- NOT strokes (no high-confidence stroke patterns in hole interior)
- Hole corners like (3,3) have 2 adjacent walls but NO strokes to connect to
- Algorithm correctly leaves them unmarked

Outside (green):
- Area around the "8"
- Reachable from borders
- NOT strokes
```

## Algorithm Summary

```
1. Build wall map from font data
   - Convert line segments to cell walls (top, right, bottom, left)

2. Flood fill from borders → mark reachable cells
   - Used to distinguish outside (green) from holes (blue)

3. Seed strokes (high-confidence patterns)
   - 3+ walls → stroke seed (intersections)
   - 2 opposite walls → stroke seed (corridors)
   - Add to stroke set and propagation queue

4. Flood propagate strokes
   - From seeds, flood to adjacent cells with same patterns
   - Only through connections (no wall blocking)
   - Only to cells with 3+ walls OR 2 opposite walls

5. Corner propagation (iterative flood)
   - 2 adjacent walls + connected to stroke → stroke
   - Works uniformly for reachable and unreachable regions
   - Repeat until no more corners added

6. Final classification
   - Stroke → purple (letter outline, dots)
   - Reachable + not stroke → green (outside maze area)
   - Unreachable + not stroke → blue (holes)
```

## Key Insights

1. **Font lines are walls, not cells** - The cells are padding around the lines
2. **Strokes are 2-cell-wide** - With internal wall creating the actual font line
3. **Connectivity, not reachability** - Strokes are identified by connection to high-confidence patterns, not by whether they're reachable from borders
4. **Uniform algorithm** - The same flood fill logic works for both reachable and unreachable regions
5. **High-confidence seeds** - 3+ walls OR 2 opposite walls = definitely a stroke
6. **Corner propagation** - Corners (2 adjacent walls) only become strokes if connected to high-confidence strokes
7. **Holes have no strokes** - Hole interiors lack high-confidence stroke patterns, so their corners remain unmarked
8. **Dots are strokes** - Small enclosed areas like '.' have walls that seed strokes, making them purple

## Usage in Maze Generation

The classification enables maze generation:
- **Outside (green)** areas get maze walls generated
- **Strokes (purple)** remain empty, forming letter outline
- **Holes (blue)** remain empty, creating internal spaces
- Result: Maze shaped like letters with solvable paths

## Edge Cases

### Dots and Small Strokes
Characters like '.', ';', '%' should have dots defined as point strokes (length 0) with 4 cells of padding (2x2 square). When properly defined in the font with walls creating this pattern, the algorithm will correctly detect them as strokes (purple).

### Corner Disambiguation
The algorithm successfully distinguishes:
- **Stroke corners**: Connected to high-confidence strokes (3+ walls or 2 opposite walls) → purple
- **Hole corners**: Isolated in regions without high-confidence strokes → blue
- **Outside corners**: No strokes to connect to → green

This works because corner propagation requires connectivity to existing strokes, and holes lack the wall patterns that seed strokes.

## Testing

Tests verify correct classification for characters N, 5, 7, 8:
- Specific cells are checked for stroke vs outside vs hole
- Edge cases include corners, intersections, and holes
- Character '8' tests the hole corner disambiguation
- All tests pass with the unified flood fill algorithm
