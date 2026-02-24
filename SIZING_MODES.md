# Sizing Modes Documentation

This document describes the three sizing modes available in the Maze Font app: **Standard**, **Autofit**, and **Compact**.

## Overview

Each mode determines how text is laid out and scaled within the available grid space. They differ in:
- Cell size (fixed vs. scaled)
- Layout strategy (word wrapping behavior)
- Grid width usage
- Vertical/horizontal centering

---

## Standard Mode

**Fixed cell size, word-wrapped layout, vertically centered**

### Behavior
- Uses fixed cell dimensions: 12×18 units (8×14 content + 2-unit padding on all sides)
- Word wrapping: breaks at word boundaries, moves to next row if word doesn't fit
- Vertical centering: entire text block centered in available height
- Uses full grid width

### Visual Example

```
Grid (full width)
┌─────────────────────────────────────┐
│                                     │
│        H E L L O                    │  ← Row 1, left-aligned
│        W O R L D                    │  ← Row 2, left-aligned
│                                     │
└─────────────────────────────────────┘
        ↑                       ↑
      Fixed                 Unused
      12×18                 space
      cells
```

### Use Case
- Traditional layout with predictable, consistent cell sizes
- Good for longer text that needs multiple rows
- Matches original maze-font behavior

### Current Issues
- Doesn't maximize use of available space
- Can leave large empty margins on the right side
- Cell size might be too small for short text in large grids

---

## Autofit Mode

**Dynamically scaled cells to maximize text size, max 2 rows**

### Behavior
- Calculates optimal cell size by:
  1. Simulating word-wrapped layout with standard cells
  2. Finding the longest line (in characters)
  3. Scaling cells to fit longest line + 1-char margin
  4. Maintaining aspect ratio (scale width and height proportionally)
- Maximum 2 rows of text
- Vertically centered
- Uses full grid width

### Visual Example

```
Grid (full width)
┌─────────────────────────────────────┐
│                                     │
│      H  E  L  L  O                  │  ← Larger cells
│      W  O  R  L  D                  │  ← to fill space
│                                     │
└─────────────────────────────────────┘
     ↑                          ↑
   Scaled                   Minimal
   cells                    margin
   (e.g., 16×24)
```

### Algorithm Details
1. **Longest line detection**: Lays out words to find max characters per row
2. **Scale factor calculation**: `availableWidth / (longestLine + 1)`
3. **Proportional scaling**: `cellHeight = cellWidth × (18/12)`
4. **Re-layout**: Applies scaled dimensions and re-wraps with new cell size

### Use Case
- Maximizes text size for short phrases
- Best for social media posts where text should be prominent
- Limited to 2 rows (overflow gets cut off)

### Current Issues
- Hard limit of 2 rows can truncate longer text
- Scaling logic is complex and hard to predict
- "Longest line" detection happens before final layout, so may not perfectly match actual layout

---

## Compact Mode

**Fixed cell size, reduced grid width, centered horizontally**

### Behavior
- Uses fixed cell dimensions: 12×18 units (same as Standard)
- Reduces effective grid width based on **longest word** (not longest line)
- Adds minimal margin: 1 character on each side of longest word
- Word wrapping within the compact width
- Vertically and horizontally centered

### Visual Example

```
Grid (full width available)
┌─────────────────────────────────────┐
│                                     │
│          H E L L O                  │  ← Centered
│          W O R L D                  │  ← within
│                                     │     compact
│                                     │     width
└─────────────────────────────────────┘
         ↑         ↑         ↑
       Margin   Content   Margin
       (1 char) (longest (1 char)
                 word +
                 space)
```

### Algorithm Details
1. **Find longest word**: `max(word.length for word in text)`
2. **Compact width**: `(longestWord + 2) × cellWidth`
3. **Layout**: Word-wrap within compact width
4. **Horizontal centering**: Center text within compact grid
5. **Rendering**: Only render compact width (not full grid)

### Use Case
- Eliminates side margins for mobile/narrow displays
- Good for names or short single-word text
- Maintains fixed cell size for consistency

### Current Issues
- Based on **longest word**, not **longest line**, which can be misleading
  - Example: "Hi world" → compact width based on "world" (5 chars)
  - But layout might be: "Hi world" on one line (8 chars total)
  - Results in unnecessary side padding
- Doesn't actually render narrower grid (uses full grid width, just centers content)
- Horizontal centering adds margin back, defeating the "compact" purpose

---

## Comparison Table

| Feature | Standard | Autofit | Compact |
|---------|----------|---------|---------|
| Cell Size | Fixed (12×18) | Scaled dynamically | Fixed (12×18) |
| Max Rows | Unlimited | 2 rows | Unlimited |
| Grid Width | Full width | Full width | Reduced (longest word + 2 chars) |
| Scaling Strategy | None | Proportional (aspect ratio maintained) | None |
| Centering | Vertical only | Vertical only | Vertical + Horizontal |
| Best For | Long text | Short phrases (max 2 rows) | Mobile, single words |

---

## Issues & Potential Improvements

### Standard Mode
- **Issue**: Underutilizes space for short text
- **Suggestion**: Could use Autofit logic as fallback for single-row text

### Autofit Mode
- **Issue**: 2-row limit is arbitrary and can truncate text
- **Suggestion**: Make max rows configurable, or calculate based on available height
- **Issue**: Longest line detection before final layout can cause mismatches
- **Suggestion**: Iterate layout calculation to converge on optimal size

### Compact Mode
- **Issue**: Uses longest **word** instead of longest **line**
- **Suggestion**: Should analyze actual line lengths after word-wrapping
- **Issue**: Horizontal centering re-adds margin, defeating "compact" goal
- **Suggestion**:
  - Option A: Actually render narrower SVG (crop sides)
  - Option B: Rename to "Centered" mode to match actual behavior
  - Option C: Left-align text within compact width (no horizontal centering)

---

## Test Cases

To validate each mode, test with these inputs:

1. **Short single word**: "HI"
   - Standard: Small text, large margins
   - Autofit: Large text, minimal margins ✓
   - Compact: Small text, centered

2. **Two medium words**: "HELLO WORLD"
   - Standard: Two rows or one row, left-aligned
   - Autofit: Large text, 1-2 rows ✓
   - Compact: Centered based on "HELLO" (6 chars)

3. **Long text**: "THE QUICK BROWN FOX JUMPS"
   - Standard: Multiple rows, left-aligned ✓
   - Autofit: Truncated to 2 rows, scaled
   - Compact: Multiple rows, centered

4. **One long word + short word**: "SUPERCALIFRAGILISTIC HI"
   - Standard: Two rows
   - Autofit: Tiny text to fit long word in 2 rows
   - Compact: **Problem**: Compact width based on "SUPERCALIFRAGILISTIC" (20 chars) → very wide, not compact at all

---

## Recommendations

Based on the analysis:

1. **Rename "Compact" to "Centered"** - Better reflects actual behavior
2. **Fix Autofit's 2-row limit** - Should be dynamic based on grid height
3. **Consider a true "Compact" mode** that:
   - Analyzes actual line widths (not just longest word)
   - Crops SVG to actual content bounds
   - No horizontal centering (left-aligned or truly compact)
4. **Add "Auto" mode** - Intelligently picks Standard or Autofit based on text length and grid aspect ratio
