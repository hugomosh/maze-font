import React, { useState, useRef, useLayoutEffect } from 'react';
import SvgGrid from './SvgGrid';
import './MazeGenerator.css';

const SIZE_OPTIONS = [
  { id: 'square',    label: 'Square',    sub: '1 : 1',  w: 36, h: 36 },
  { id: 'landscape', label: 'Landscape', sub: '16 : 9', w: 50, h: 28 },
  { id: 'story',     label: 'Story',     sub: '9 : 16', w: 21, h: 37 },
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

const MAX_CHARS = 20;

const MazeGenerator = () => {
  const [text, setText] = useState('Your Message Here');
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const [showPath, setShowPath] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('square');
  const [sizingMode, setSizingMode] = useState('autofit');
  const [verticalBias, setVerticalBias] = useState(1);
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
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      canvas.width = svg.width.baseVal.value;
      canvas.height = svg.height.baseVal.value;
      const ctx = canvas.getContext('2d');
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
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

        {/* Handle bar — only shown on mobile */}
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

        {/* Scrollable content */}
        <div className="ctrl-inner">

          {/* Brand — desktop only */}
          <div className="app-brand">
            <h1 className="app-title">Maze Font</h1>
            <p className="app-sub">Type a name, get a maze</p>
          </div>

          {/* Text input — desktop only (mobile gets its own bar) */}
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

        {/* Mobile-only text input */}
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

        {/* Overlay when sheet is open */}
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
            />
          </div>
        </div>

      </main>
    </div>
  );
};

export default MazeGenerator;
