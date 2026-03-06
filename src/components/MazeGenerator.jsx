import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import SvgGrid from './SvgGrid';
import { MazeGlyph } from './MazeGlyph';
import { PALETTES } from '../lib/svgBuilder';
import './MazeGenerator.css';

const SIZE_OPTIONS = [
  { id: 'square',    label: 'Square',    sub: '1:1',   w: 34, h: 34 },
  { id: 'landscape', label: 'Landscape', sub: '16:9',  w: 48, h: 27 },
  { id: 'story',     label: 'Story',     sub: '9:16',  w: 20, h: 36 },
];

const SIZING_OPTIONS = [
  { id: 'standard', label: 'Standard', desc: 'Fixed cell size — letters stay the same scale regardless of canvas.' },
  { id: 'compact',  label: 'Compact',  desc: 'Scale letters to fill the available space uniformly.' },
  { id: 'autofit',  label: 'Autofit',  desc: 'Maximize letter size — grid fits tight to the text block.' },
];

const BIAS_OPTIONS = [
  { id: 1, label: 'Normal',   title: 'Uniform random maze' },
  { id: 3, label: 'Vertical', title: 'Prefer vertical corridors' },
  { id: 8, label: 'Strong',   title: 'Strong vertical bias' },
];

const PALETTE_OPTIONS = [
  { id: 'vivid',     label: 'Vivid' },
  { id: 'dark',      label: 'Dark' },
  { id: 'neon',      label: 'Neon' },
  { id: 'pastel',    label: 'Pastel' },
  { id: 'earth',     label: 'Earth' },
  { id: 'mono',      label: 'Mono' },
  { id: 'ink',       label: 'Ink' },
  { id: 'blueprint', label: 'Blueprint' },
];

// pathWidth is a multiplier: stroke = unitSize * 0.15 * pathWidth
// pathWidth ≈ 6.67 fills one corridor unit (full cell width)
const PATH_WIDTH_MIN = 0.2;
const PATH_WIDTH_MAX = 8.0;
const PATH_WIDTH_STEP = 0.1;

// 3×3 position grid — row-major order
const POS_GRID = [
  ['top-left',    'top',    'top-right'],
  ['left',        'center', 'right'],
  ['bottom-left', 'bottom', 'bottom-right'],
];

const MAX_CHARS = 30;
const DEFAULT_TEXT = 'Hola Mundo! Hello World!';

const MazeGenerator = () => {
  const params = new URLSearchParams(window.location.search);
  const [shouldAutoDownload] = useState(() => params.get('dl') === '1');
  const hasAutoDownloaded = useRef(false);
  // text: two states — live (immediate input display) + debounced (triggers maze regen)
  const [textLive, setTextLive] = useState(params.get('t') ?? DEFAULT_TEXT);
  const [text, setText] = useState(textLive);
  const textTimerRef = useRef(null);
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const [showPath, setShowPath] = useState(params.get('path') === '1');
  const [aspectRatio, setAspectRatio] = useState(params.get('ar') ?? 'square');
  const [sizingMode, setSizingMode] = useState(params.get('sz') ?? 'autofit');
  const [verticalBias, setVerticalBias] = useState(Number(params.get('vb') ?? 1));
  const [textPosition, setTextPosition] = useState(params.get('pos') ?? 'center');
  const [palette, setPalette] = useState(() => {
    const raw = params.get('palette') ?? params.get('theme') ?? 'vivid';
    return raw === 'classic' ? 'vivid' : raw;
  });
  const [textAlign, setTextAlign] = useState(params.get('align') ?? 'center');
  const [regularWalls, setRegularWalls] = useState(params.get('rw') === '1');
  const [handDrawn, setHandDrawn] = useState(params.get('hd') === '1');
  const [pathColor, setPathColor] = useState(() => {
    const v = params.get('pc'); return v ? `#${v}` : '#ff6b6b';
  });
  const [pathOpacity, setPathOpacity] = useState(() => {
    const v = params.get('po'); return v ? parseFloat(v) : 1.0;
  });
  // pathWidth: two states — live (immediate slider display) + debounced (feeds renderOptions)
  const [pathWidthLive, setPathWidthLive] = useState(() => {
    const v = params.get('pw'); return v ? parseFloat(v) : 1.0;
  });
  const [pathWidth, setPathWidth] = useState(pathWidthLive);
  const pathWidthTimerRef = useRef(null);
  const handlePathWidthChange = (val) => {
    setPathWidthLive(val);
    clearTimeout(pathWidthTimerRef.current);
    pathWidthTimerRef.current = setTimeout(() => setPathWidth(val), 150);
  };
  const [seed, setSeed] = useState(() => {
    const v = params.get('seed'); return v !== null ? parseInt(v, 10) : null;
  });
  const [layoutTipOpen, setLayoutTipOpen] = useState(false);
  const [corridorsTipOpen, setCorridorsTipOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const gridRef = useRef(null);
  const svgRef = useRef(null);

  useLayoutEffect(() => {
    if (!gridRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setGridSize({ width, height });
    });
    ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, []);

  // Clean up debounce timers on unmount
  useEffect(() => () => {
    clearTimeout(textTimerRef.current);
    clearTimeout(pathWidthTimerRef.current);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (text !== DEFAULT_TEXT)     p.set('t', text);
    if (aspectRatio !== 'square')  p.set('ar', aspectRatio);
    if (sizingMode !== 'autofit')  p.set('sz', sizingMode);
    if (verticalBias !== 1)        p.set('vb', verticalBias);
    if (textPosition !== 'center') p.set('pos', textPosition);
    if (palette !== 'vivid')       p.set('palette', palette);
    if (textAlign !== 'center')    p.set('align', textAlign);
    if (regularWalls)              p.set('rw', '1');
    if (showPath)                  p.set('path', '1');
    if (handDrawn)                 p.set('hd', '1');
    if (pathColor !== '#ff6b6b')   p.set('pc', pathColor.replace('#', ''));
    if (pathWidth !== 1.0)         p.set('pw', pathWidth);
    if (pathOpacity !== 1.0)       p.set('po', pathOpacity);
    if (seed !== null)             p.set('seed', seed);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [text, aspectRatio, sizingMode, verticalBias, textPosition, palette, textAlign,
      regularWalls, showPath, handDrawn, pathColor, pathOpacity, pathWidth, seed]);

  const handleChange = e => {
    const val = e.target.value;
    if (val.length > MAX_CHARS) return;
    setTextLive(val);
    clearTimeout(textTimerRef.current);
    textTimerRef.current = setTimeout(() => setText(val), 350);
  };

  const handleDownload = async () => {
    if (!svgRef.current) return;
    try {
      // Two SVG layers: maze walls + optional path overlay — composite both.
      const svgEls = svgRef.current.querySelectorAll('svg');
      if (!svgEls.length) return;
      const baseSvg = svgEls[0];
      const srcW = baseSvg.width.baseVal.value;
      const srcH = baseSvg.height.baseVal.value;

      // Scale up so the longer edge is at least 2048px
      const EXPORT_MIN_PX = 2048;
      const scale = Math.max(1, Math.ceil(EXPORT_MIN_PX / Math.max(srcW, srcH)));
      const canvasW = Math.round(srcW * scale);
      const canvasH = Math.round(srcH * scale);

      const clone = baseSvg.cloneNode(true);
      clone.setAttribute('viewBox', `0 0 ${srcW} ${srcH}`);
      clone.setAttribute('width', canvasW);
      clone.setAttribute('height', canvasH);

      // Append path layer children (if present) into the single export SVG.
      if (svgEls.length > 1) {
        for (const child of svgEls[1].children) {
          clone.appendChild(child.cloneNode(true));
        }
      }

      const svgData = new XMLSerializer().serializeToString(clone);
      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvasW, canvasH);
        canvas.toBlob(pngBlob => {
          const link = document.createElement('a');
          link.download = text
            ? `maze-${text.replace(/\s+/g, '-').toLowerCase()}.png`
            : 'maze.png';
          link.href = URL.createObjectURL(pngBlob);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          URL.revokeObjectURL(link.href);
        });
      };
      img.src = url;
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  useEffect(() => {
    if (!shouldAutoDownload || hasAutoDownloaded.current) return;
    if (!svgRef.current || gridSize.width === 0) return;
    hasAutoDownloaded.current = true;
    handleDownload();
  }, [gridSize, shouldAutoDownload]);

  const renderOptions = { palette, showPath, regularWalls, handDrawn, pathColor, pathOpacity, pathWidth };

  return (
    <div className="maze-app">

      {/* ── Controls: sidebar on desktop / bottom sheet on mobile ── */}
      <aside className={`ctrl-panel${panelOpen ? ' open' : ''}`}>

        {/* Handle — mobile only */}
        <button
          className="sheet-handle-btn"
          onClick={() => setPanelOpen(v => !v)}
          aria-label="Toggle settings"
        >
          <span className="sheet-pip" />
          <span className="sheet-handle-label">
            {panelOpen ? 'Close' : 'Customize ↑'}
          </span>
        </button>

        <div className="ctrl-inner">

          {/* Brand — desktop only */}
          <div className="app-brand">
            <MazeGlyph text="MAZE FONT" height={26} gap={2} />
          </div>

          {/* Text — desktop only */}
          <div className="ctrl-section ctrl-desktop-only">
            <label className="ctrl-label">Your Text</label>
            <div className="text-input-group">
              <input
                type="text"
                value={textLive}
                onChange={handleChange}
                onFocus={e => e.target.select()}
                placeholder="Enter your message..."
                className="maze-input"
              />
              <span className="char-badge">{textLive.length}/{MAX_CHARS}</span>
            </div>
          </div>

          {/* Format — visual size cards */}
          <div className="ctrl-section">
            <label className="ctrl-label">Format</label>
            <div className="size-cards">
              {SIZE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`size-card${aspectRatio === opt.id ? ' active' : ''}`}
                  onClick={() => { setAspectRatio(opt.id); setPanelOpen(false); }}
                >
                  <span className="size-preview-wrap">
                    <span className="size-shape" style={{ width: opt.w, height: opt.h }} />
                  </span>
                  <span className="size-name">{opt.label}</span>
                  <span className="size-ratio">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Position + Align — side by side */}
          <div className="ctrl-section">
            <div className="pos-align-row">
              <div className="pos-col">
                <label className="ctrl-label">Position</label>
                <div className="pos-grid">
                  {POS_GRID.map((row, r) => row.map(pos => (
                    <button
                      key={pos}
                      className={`pos-dot${textPosition === pos ? ' active' : ''}`}
                      onClick={() => setTextPosition(pos)}
                      title={pos.replace('-', ' ')}
                    />
                  )))}
                </div>
              </div>
              <div className="align-col">
                <label className="ctrl-label">Align</label>
                <div className="align-ctrl">
                  {['left', 'center', 'right'].map(align => (
                    <button
                      key={align}
                      className={`align-btn align-btn--${align}${textAlign === align ? ' active' : ''}`}
                      onClick={() => setTextAlign(align)}
                      title={align}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Palette */}
          <div className="ctrl-section">
            <label className="ctrl-label">Palette</label>
            <div className="palette-cards">
              {PALETTE_OPTIONS.map(opt => {
                const p = PALETTES[opt.id];
                const dots = p.glyph !== null ? [p.glyph] : (p.letterColors ?? []).slice(0, 3);
                return (
                  <button
                    key={opt.id}
                    className={`palette-card${palette === opt.id ? ' active' : ''}`}
                    onClick={() => setPalette(opt.id)}
                    title={opt.label}
                  >
                    <span className="palette-bg" style={{ background: p.bg }}>
                      <span className="palette-dots">
                        {dots.map((c, i) => <span key={i} className="palette-dot" style={{ background: c }} />)}
                      </span>
                    </span>
                    <span className="palette-name">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Layout */}
          <div className="ctrl-section">
            <div className="ctrl-label-row">
              <label className="ctrl-label">Layout</label>
              <button
                className={`info-btn${layoutTipOpen ? ' active' : ''}`}
                onClick={() => setLayoutTipOpen(v => !v)}
                aria-label="Layout mode info"
              >ⓘ</button>
            </div>
            <div className="segment-ctrl">
              {SIZING_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={sizingMode === opt.id ? 'active' : ''}
                  onClick={() => setSizingMode(opt.id)}
                >{opt.label}</button>
              ))}
            </div>
            {layoutTipOpen && (
              <div className="layout-tip">
                {SIZING_OPTIONS.map(opt => (
                  <div key={opt.id} className={`layout-tip-row${sizingMode === opt.id ? ' current' : ''}`}>
                    <span className="layout-tip-name">{opt.label}</span>
                    <span className="layout-tip-desc">{opt.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Corridors */}
          <div className="ctrl-section">
            <div className="ctrl-label-row">
              <label className="ctrl-label">Corridors</label>
              <button
                className={`info-btn${corridorsTipOpen ? ' active' : ''}`}
                onClick={() => setCorridorsTipOpen(v => !v)}
                aria-label="Corridors info"
              >ⓘ</button>
            </div>
            {corridorsTipOpen && (
              <div className="layout-tip">
                <div className="layout-tip-row">
                  <span className="layout-tip-desc">Controls how long vertical hallways grow. Higher bias = taller straight runs, giving the maze a more columnar feel.</span>
                </div>
              </div>
            )}
            <div className="segment-ctrl">
              {BIAS_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={verticalBias === opt.id ? 'active' : ''}
                  title={opt.title}
                  onClick={() => setVerticalBias(opt.id)}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Regular walls toggle */}
          <div className="ctrl-section">
            <div
              className="toggle-row"
              role="button"
              tabIndex={0}
              onClick={() => setRegularWalls(v => !v)}
              onKeyDown={e => e.key === ' ' && setRegularWalls(v => !v)}
            >
              <span className="toggle-label">Regular walls</span>
              <span className={`toggle-sw${regularWalls ? ' on' : ''}`}>
                <span className="toggle-thumb" />
              </span>
            </div>
          </div>

          {/* Show path toggle + sub-options */}
          <div className="ctrl-section">
            <div
              className="toggle-row"
              role="button"
              tabIndex={0}
              onClick={() => setShowPath(v => !v)}
              onKeyDown={e => e.key === ' ' && setShowPath(v => !v)}
            >
              <span className="toggle-label">Show solution path</span>
              <span className={`toggle-sw${showPath ? ' on' : ''}`}>
                <span className="toggle-thumb" />
              </span>
            </div>

            {showPath && (
              <div className="path-options">
                {/* Hand-drawn toggle */}
                <div
                  className="toggle-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => setHandDrawn(v => !v)}
                  onKeyDown={e => e.key === ' ' && setHandDrawn(v => !v)}
                >
                  <span className="toggle-label toggle-label--sub">Hand-drawn</span>
                  <span className={`toggle-sw${handDrawn ? ' on' : ''}`}>
                    <span className="toggle-thumb" />
                  </span>
                </div>

                {/* Color + Opacity */}
                <div className="path-color-row">
                  <span className="toggle-label toggle-label--sub">Color</span>
                  <label className="color-swatch-label">
                    <input
                      type="color"
                      value={pathColor}
                      onChange={e => setPathColor(e.target.value)}
                      className="color-swatch-input"
                    />
                    <span className="color-swatch-preview" style={{ background: pathColor }} />
                  </label>
                </div>
                <div className="path-opacity-row">
                  <div className="path-opacity-header">
                    <span className="toggle-label toggle-label--sub">Opacity</span>
                    <span className="path-width-value">{Math.round(pathOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="path-opacity-slider"
                    style={{ '--val': pathOpacity }}
                    min={0}
                    max={1}
                    step={0.01}
                    value={pathOpacity}
                    onChange={e => setPathOpacity(parseFloat(e.target.value))}
                  />
                </div>

                {/* Width slider */}
                <div className="path-width-row">
                  <div className="path-width-header">
                    <span className="toggle-label toggle-label--sub">Width</span>
                    <span className="path-width-value">{pathWidthLive.toFixed(1)}×</span>
                  </div>
                  <input
                    type="range"
                    className="path-width-slider"
                    style={{ '--val': pathWidthLive }}
                    min={PATH_WIDTH_MIN}
                    max={PATH_WIDTH_MAX}
                    step={PATH_WIDTH_STEP}
                    value={pathWidthLive}
                    onChange={e => handlePathWidthChange(parseFloat(e.target.value))}
                  />
                  <div className="path-width-ticks">
                    <span>Thin</span>
                    <span>Fill</span>
                    <span>Bold</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Download */}
          <div className="ctrl-section">
            <button className="download-btn" onClick={handleDownload}>
              Download PNG
            </button>
          </div>

        </div>
      </aside>

      {/* ── Main canvas area ── */}
      <main className="maze-main">

        {/* Mobile text bar */}
        <div className="mobile-text-bar">
          <input
            type="text"
            value={textLive}
            onChange={handleChange}
            onFocus={e => e.target.select()}
            placeholder="Enter your message..."
            className="maze-input"
          />
          <span className="char-badge">{textLive.length}/{MAX_CHARS}</span>
        </div>

        {/* Sheet overlay */}
        <div
          className={`sheet-overlay${panelOpen ? ' visible' : ''}`}
          onClick={() => setPanelOpen(false)}
        />

        {/* Grid */}
        <div className="grid-wrapper">
          <div
            className={`grid-container ${aspectRatio}${sizingMode === 'autofit' ? ' autofit-mode' : ''}`}
            ref={gridRef}
          >
            <SvgGrid
              ref={svgRef}
              width={gridSize.width}
              height={gridSize.height}
              text={text}
              renderOptions={renderOptions}
              sizingMode={sizingMode}
              verticalBias={verticalBias}
              position={textPosition}
              textAlign={textAlign}
              seed={seed}
            />
          </div>
        </div>

      </main>
    </div>
  );
};

export default MazeGenerator;
