import React, { useState, useRef, useLayoutEffect } from 'react';
import SvgGrid from './SvgGrid';
import { MazeGlyph } from './MazeGlyph';
import './MazeGenerator.css';

const SIZE_OPTIONS = [
  { id: 'square',    label: 'Square',    sub: '1:1',   w: 34, h: 34 },
  { id: 'landscape', label: 'Landscape', sub: '16:9',  w: 48, h: 27 },
  { id: 'story',     label: 'Story',     sub: '9:16',  w: 20, h: 36 },
];

const SIZING_OPTIONS = [
  { id: 'standard', label: 'Standard', title: 'Fixed cell size' },
  { id: 'autofit',  label: 'Autofit',  title: 'Scale to fill space' },
  { id: 'compact',  label: 'Compact',  title: 'Minimal padding' },
];

const BIAS_OPTIONS = [
  { id: 1, label: 'Normal',   title: 'Uniform random maze' },
  { id: 3, label: 'Vertical', title: 'Prefer vertical corridors' },
  { id: 8, label: 'Strong',   title: 'Strong vertical bias' },
];

const THEME_OPTIONS = [
  { id: 'classic', label: 'Classic' },
  { id: 'dark',    label: 'Dark' },
  { id: 'mono',    label: 'Mono' },
  { id: 'ink',     label: 'Ink' },
];

// 3×3 position grid — row-major order
const POS_GRID = [
  ['top-left',    'top',    'top-right'],
  ['left',        'center', 'right'],
  ['bottom-left', 'bottom', 'bottom-right'],
];

const MAX_CHARS = 20;

const MazeGenerator = () => {
  const [text, setText] = useState('Your Message Here');
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const [showPath, setShowPath] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('square');
  const [sizingMode, setSizingMode] = useState('autofit');
  const [verticalBias, setVerticalBias] = useState(1);
  const [textPosition, setTextPosition] = useState('center');
  const [theme, setTheme] = useState('classic');
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

  const handleChange = e => {
    if (e.target.value.length <= MAX_CHARS) setText(e.target.value);
  };

  const handleDownload = async () => {
    if (!svgRef.current) return;
    try {
      const svg = svgRef.current;
      const srcW = svg.width.baseVal.value;
      const srcH = svg.height.baseVal.value;

      // Scale up so the longer edge is at least 2048px
      const EXPORT_MIN_PX = 2048;
      const scale = Math.max(1, Math.ceil(EXPORT_MIN_PX / Math.max(srcW, srcH)));
      const canvasW = Math.round(srcW * scale);
      const canvasH = Math.round(srcH * scale);

      // Clone SVG and stamp explicit export dimensions so the browser
      // rasterises it at full resolution rather than screen size.
      // viewBox locks the content coordinate space to the original screen
      // dimensions so the SVG renderer scales it up proportionally.
      const clone = svg.cloneNode(true);
      clone.setAttribute('viewBox', `0 0 ${srcW} ${srcH}`);
      clone.setAttribute('width', canvasW);
      clone.setAttribute('height', canvasH);

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
          link.click();
          URL.revokeObjectURL(url);
          URL.revokeObjectURL(link.href);
        });
      };
      img.src = url;
    } catch (err) {
      console.error('Download error:', err);
    }
  };

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
                value={text}
                onChange={handleChange}
                placeholder="Enter your message..."
                className="maze-input"
              />
              <span className="char-badge">{text.length}/{MAX_CHARS}</span>
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

          {/* Position — 3×3 dot grid */}
          <div className="ctrl-section">
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

          {/* Style / theme */}
          <div className="ctrl-section">
            <label className="ctrl-label">Style</label>
            <div className="segment-ctrl">
              {THEME_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={theme === opt.id ? 'active' : ''}
                  onClick={() => setTheme(opt.id)}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div className="ctrl-section">
            <label className="ctrl-label">Layout</label>
            <div className="segment-ctrl">
              {SIZING_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={sizingMode === opt.id ? 'active' : ''}
                  title={opt.title}
                  onClick={() => setSizingMode(opt.id)}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Corridors */}
          <div className="ctrl-section">
            <label className="ctrl-label">Corridors</label>
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

          {/* Show path toggle */}
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
            value={text}
            onChange={handleChange}
            placeholder="Enter your message..."
            className="maze-input"
          />
          <span className="char-badge">{text.length}/{MAX_CHARS}</span>
        </div>

        {/* Sheet overlay */}
        <div
          className={`sheet-overlay${panelOpen ? ' visible' : ''}`}
          onClick={() => setPanelOpen(false)}
        />

        {/* Grid */}
        <div className="grid-wrapper">
          <div
            className={`grid-container ${aspectRatio}${sizingMode === 'compact' ? ' compact-mode' : ''}`}
            ref={gridRef}
          >
            <SvgGrid
              ref={svgRef}
              width={gridSize.width}
              height={gridSize.height}
              text={text}
              showPath={showPath}
              sizingMode={sizingMode}
              verticalBias={verticalBias}
              position={textPosition}
              theme={theme}
            />
          </div>
        </div>

      </main>
    </div>
  );
};

export default MazeGenerator;
