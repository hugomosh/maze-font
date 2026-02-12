# Maze Font & Generator

## Project Overview

This project explores a unique concept: a "maze font" where each character glyph is represented as a miniature maze. Beyond simply displaying characters, the system aims to dynamically generate paths that connect these individual character-mazes, forming a continuous, solvable labyrinth composed of text.

The primary tool for this is a custom-built **Glyph Editor**, allowing for intuitive creation and modification of these maze-like characters.

## Features of the Glyph Editor

The interactive Glyph Editor provides a comprehensive set of tools for designing and refining maze font glyphs:

*   **Interactive Drawing (Diamond Grid):** Edit glyphs on a specialized diamond-node grid. Click to toggle horizontal or vertical wall segments, and drag the mouse for continuous drawing.
*   **Visual Feedback:**
    *   **Stroke Detection Visualization:** Clearly see different regions of the maze (outside, hole, enclosed corridor, potential stroke, connected stroke) highlighted with distinct colors, aiding in understanding the maze generation logic.
    *   **Cell Coordinates:** Each grid cell displays its `(x,y)` coordinates, providing precise editing guidance.
*   **Undo/Redo History:** Full history tracking for all editing actions, allowing for easy correction of mistakes.
*   **Grab and Move:** Hold the spacebar to activate "grab" mode, then click and drag the entire glyph to reposition it on the canvas.
*   **Import/Export:**
    *   **Export:** Save your entire font set as a JSON file, preserving your custom glyphs.
    *   **Import:** Load existing font definitions from a JSON file, enabling easy sharing and iteration.
*   **Character Management:**
    *   **Character Palette:** A visual display of all characters in your font set, allowing quick selection for editing.
    *   **Add New Characters:** Easily add new characters to your font, starting with a blank canvas for fresh designs.

## Getting Started

To set up and run the project locally:

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Start the Development Server:**
    ```bash
    npm run dev
    ```
    The application will open in your browser, typically at `http://localhost:5173/`.

## Future Enhancements (TODO)

*   **Path Generation Between Letters:** Implement an algorithm to automatically generate visually appealing and solvable maze paths that seamlessly connect one character-maze to the next, forming a continuous, readable maze from a given string of text. This involves analyzing the entry and exit points of each character's maze and finding optimal connections.
