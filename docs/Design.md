# Maze Font Design

This document outlines the design for a project to create, display, and solve mazes that form words using a custom-designed "Maze Font".

## Core Concept

The fundamental idea is to create a font where each character's glyph is composed of maze walls. A message written in this font becomes a large maze. Solving the maze reveals the original message, as the solution path traces the shape of the letters.

## Font Construction Rules

The font's design is based on a strict set of rules to ensure consistency and solvability.

1.  **Base Grid (Square Grid):** The foundation is a standard square grid.
2.  **Guide Grid (Diamond Grid):** A secondary grid is overlaid on the base grid. It consists of diagonal lines at 45-degree angles, intersecting every 2 units to form a diamond pattern. The nodes of this diamond grid are the only valid connection points for walls.
3.  **Wall Segments:** Walls are always straight lines, either horizontal or vertical. Each wall segment is exactly 2 units long and must connect two nodes on the diamond grid.
4.  **Connectivity:** Only one wall segment can be connected within a single diamond grid node. So no crosses. This guarantees that the font will have two square cells for the width of the strokes.

## Key Project Areas

### 1. Font Designer Application

An interactive tool for creating and editing the maze font glyphs.

**Features:**
-   **Glyph Library:** Easily switch between different characters (A-Z, 0-9, etc.) to design or modify them.
-   **Rule-Assisted Drawing:** The editor should make it intuitive to draw wall segments that automatically adhere to the construction rules (e.g., snapping to diamond grid nodes, enforcing 2-unit length).
-   **Persistence:** Save the entire font configuration to a file.
-   **State Management:** Include multi-level undo/redo functionality to make the design process forgiving.
-   **Real-time Validation:** Provide visual feedback to indicate if a rule is being violated.

### 2. Text-to-Maze Generator

A tool that takes a string of text and generates a complete, solvable maze.

**Process:**
1.  **Layout:** Arrange the corresponding font glyphs for the input message onto a larger grid.
2.  **Path Weaving:** Generate a single, continuous solution path that traverses through all the letters in the message, effectively "carving" the path out of the letter walls by removing specific segments to create openings.
3.  **Maze Generation:** Fill the remaining empty space around the letters with a valid, unsolvable maze that respects the font's wall construction rules. The goal is to ensure there are no unintended solution paths.
4.  **Finalization:** Ensure each letter's interior is fully connected to the main solution path, and close off any loops that don't contribute to the intended path.

## User Experience & Aesthetics

### Image Export

Users should be able to export the generated maze (both unsolved and with the solution path visible) as a standard image file (e.g., PNG, SVG) for sharing or printing.

### Visual Style

-   **Color Palette:**
    -   Grid & Axes Labels: Orange (`#f97316`)
    -   Diamond Grid Guides: Light Blue (`#93c5fd`, 2px width)
-   **Wall Appearance:** The maze walls should have a "hand-drawn" feel, similar to the style of xkcd comics. This could be achieved with slight waviness or irregularity in the lines.

## Open Questions & Technical Considerations

-   **Technology Stack:**  Progressive Web App using Canvas/SVG.
-   **Hand-Drawn Effect:** How will the "xkcd" aesthetic be implemented? (e.g., using a library like `rough.js`, applying SVG filters, or using shaders?)
-   **Maze Algorithm:** What algorithm will be used for generating the filler maze? (e.g., Recursive Backtracking, Prim's Algorithm?)
-   **Font Storage Format:** The font will be save in JSON. We should try to make it propertary. I would like to save it as an actual font.
-   
                                                                                                                               