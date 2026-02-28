# Maze Font Generator

Renders text as a continuous solvable maze. Each letter is drawn as maze corridors; letters connect seamlessly into one traversable path that visits every character in sequence.

**Live:** https://hugomosh.github.io/maze-font/

---

## URL API

Everything is controlled through URL query parameters — no account, no form submission. Build a URL, share it, bookmark it, automate it.

```
https://hugomosh.github.io/maze-font/?t=Hello+World&theme=dark&seed=42
```

### Parameters

| Param | Default | Values | Description |
|---|---|---|---|
| `t` | `Hola Mundo! Hello World!` | ≤ 20 chars, URI-encoded | Text to render as a maze |
| `seed` | absent *(random)* | any integer | Seed the RNG — same seed always produces the same maze |
| `ar` | `square` | `square` · `landscape` · `story` | Canvas aspect ratio |
| `sz` | `autofit` | `autofit` · `standard` · `compact` | Layout / sizing mode |
| `vb` | `1` | `1` · `3` · `8` | Vertical corridor bias |
| `pos` | `center` | see below | Text position on canvas |
| `theme` | `classic` | `classic` · `dark` · `mono` · `ink` | Color theme |
| `align` | `center` | `left` · `center` · `right` | Text alignment within the block |
| `rw` | absent | `1` | Regular walls — renders all walls the same color |
| `path` | absent | `1` | Show the solution path overlay |
| `dl` | absent | `1` | Auto-download PNG on page load |

**Default values are omitted from the URL.** A fresh default state produces a clean URL with no query string.

---

### Aspect ratios (`ar`)

| Value | Ratio | Use case |
|---|---|---|
| `square` | 1 : 1 | Profile pictures, prints |
| `landscape` | 16 : 9 | Desktop wallpaper, presentations |
| `story` | 9 : 16 | Mobile wallpaper, Instagram stories |

### Layout modes (`sz`)

| Value | Description |
|---|---|
| `autofit` | Maximizes letter size — grid fits tight to the text block |
| `standard` | Fixed cell size — letters stay the same scale regardless of canvas size |
| `compact` | Scale letters uniformly to fill the available space |

### Text position (`pos`)

9-point grid:

```
top-left    top    top-right
left        center      right
bottom-left bottom bottom-right
```

### Vertical bias (`vb`)

| Value | Label | Effect |
|---|---|---|
| `1` | Normal | Uniform random corridors |
| `3` | Vertical | Prefer vertical runs |
| `8` | Strong | Strongly vertical corridors |

### Color themes (`theme`)

| Value | Background | Walls | Letters |
|---|---|---|---|
| `classic` | Off-white | Light gray | Rainbow per letter |
| `dark` | Dark navy | Dark blue | Rainbow per letter |
| `mono` | White | Light gray | Dark slate |
| `ink` | White | Medium gray | Black |

---

### Auto-download (`dl=1`)

Adding `?dl=1` causes the PNG to download automatically as soon as the maze finishes rendering. Combine with `seed` for fully reproducible, scriptable output:

```
?t=Hello+World&seed=42&dl=1
```

The page renders, the PNG downloads at ≥ 2048 px on the long edge, done. Works in any browser. For headless / CI use, pair with a tool like Puppeteer that can open a URL and wait for the download.

`dl` is a one-shot trigger — it is not persisted in the URL after firing.

---

## Examples

```
# Dark theme, landscape, seeded
?t=MAZE+FONT&theme=dark&ar=landscape&seed=1337

# Story format, top-left, show solution path
?t=Hello&ar=story&pos=top-left&path=1

# Compact layout, vertical corridors, monochrome walls
?t=HELLO+WORLD&sz=compact&vb=8&rw=1

# Download immediately — deterministic
?t=Open+Sesame&seed=999&dl=1
```

---

## Getting Started

```bash
npm install
npm run dev      # dev server at http://localhost:5173/maze-font/
npm test         # run test suite (Vitest)
npm run build    # production build → dist/
npm run deploy   # build + push to GitHub Pages
```

---

## Architecture

| File | Role |
|---|---|
| `src/components/MazeGenerator.jsx` | App shell — URL param sync, download handler, UI controls |
| `src/components/SvgGrid.jsx` | SVG renderer, maze layout, theming |
| `src/lib/wordMazeGenerator.js` | Core maze generation algorithm |
| `src/lib/mazeGenerator.js` | Recursive backtracker (background fill) |
| `src/lib/rng.js` | `mulberry32` seeded PRNG |
| `src/assets/maze-font.json` | Font glyph data — wall segments `[x1,y1,x2,y2]` per character |
| `src/components/GlyphEditor.jsx` | Interactive font editor |

---

## License

[CC-BY-NC-SA-4.0](LICENSE)
