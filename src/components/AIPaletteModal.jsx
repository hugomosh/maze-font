import React, { useState, useEffect, useRef } from 'react';
import './AIPaletteModal.css';

const THEME_SUGGESTIONS = [
  'Matrix', 'Sunset', 'Ocean', 'Cyberpunk', 'Forest',
  'Rose Gold', 'Arctic', 'Sepia', 'Halloween', 'Sakura',
];

function buildPrompt(theme) {
  return `Design a beautiful maze poster color palette for the theme "${theme}". Return ONLY valid JSON, no explanation.

{
  "bg": "#hex",
  "maze": "#hex",
  "letterColors": ["#hex", "#hex", ...],
  "pathColor": "#hex"
}

Rules:
- bg: the canvas/paper color. Must be a calm, desaturated tone — not pure white or pure black. For dark themes use deep muted tones (e.g. #0d1117, #1a0a2e). For light themes use soft warm/cool off-whites (e.g. #f5f0e8, #eef2f7). Avoid saturated or "loud" backgrounds.
- maze: a subtle step from bg in the same hue family — slightly lighter or darker. The maze grid should feel quiet, not dominant.
- letterColors: however many colors feel right for the theme — a single accent, a tight 2–3 color story, or a rich multi-color spectrum. They must stand out clearly against both bg and maze. Use the theme's signature hues: saturated, vibrant, or rich — this is where the personality lives.
- pathColor: one accent color (can reuse a letterColor). Should feel like a highlight or glow.

Good palette design: bg and maze fade into the background; letterColors are the visual stars.`;
}

function parseAndValidate(text) {
  const obj = JSON.parse(text.trim());
  const isHex = v => /^#[0-9a-fA-F]{6}$/.test(v);
  if (!isHex(obj.bg))   throw new Error('Invalid "bg" color');
  if (!isHex(obj.maze)) throw new Error('Invalid "maze" color');
  if (obj.glyph && !isHex(obj.glyph)) throw new Error('Invalid "glyph" color');
  if (obj.letterColors) {
    if (!Array.isArray(obj.letterColors) || !obj.letterColors.every(isHex))
      throw new Error('Invalid "letterColors"');
  }
  if (obj.pathColor && !isHex(obj.pathColor)) throw new Error('Invalid "pathColor"');
  return {
    bg: obj.bg,
    maze: obj.maze,
    glyph: obj.glyph ?? null,
    letterColors: obj.letterColors ?? null,
    pathColor: obj.pathColor,
  };
}

const AIPaletteModal = ({ onApply, onClose }) => {
  const [theme, setTheme] = useState('Matrix');
  const [jsonText, setJsonText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const promptRef = useRef(null);

  const prompt = buildPrompt(theme);

  useEffect(() => {
    if (!jsonText.trim()) { setParsed(null); setError(''); return; }
    try {
      setParsed(parseAndValidate(jsonText));
      setError('');
    } catch (e) {
      setParsed(null);
      setError(e.message);
    }
  }, [jsonText]);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const swatchColors = parsed
    ? (parsed.letterColors ?? [parsed.glyph ?? parsed.maze]).slice(0, 8)
    : [];

  return (
    <div className="ai-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ai-modal" role="dialog" aria-modal="true" aria-label="Create palette with AI">

        <div className="ai-modal-header">
          <span className="ai-modal-title">Create palette with AI</span>
          <button className="ai-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ai-modal-body">

          {/* Step 1 — pick a theme */}
          <div className="ai-step">
            <div className="ai-step-label">1. Choose a theme</div>
            <input
              className="ai-theme-input"
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="e.g. Sunset, Cyberpunk…"
            />
            <div className="ai-chips">
              {THEME_SUGGESTIONS.map(s => (
                <button
                  key={s}
                  className={`ai-chip${theme === s ? ' active' : ''}`}
                  onClick={() => setTheme(s)}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* Step 2 — copy prompt */}
          <div className="ai-step">
            <div className="ai-step-label">2. Copy this prompt into any AI chat</div>
            <div className="ai-prompt-block">
              <pre ref={promptRef} className="ai-prompt-pre">{prompt}</pre>
              <button className="ai-copy-btn" onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="ai-hint">
              Open any AI chat — paste the prompt, copy the JSON back here. Have fun!
            </p>
          </div>

          {/* Step 3 — paste JSON */}
          <div className="ai-step">
            <div className="ai-step-label">3. Paste the JSON result</div>
            <textarea
              className={`ai-json-textarea${error ? ' has-error' : parsed ? ' has-success' : ''}`}
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              placeholder={'{\n  "bg": "#0d1117",\n  "maze": "#30363d",\n  "letterColors": ["#ff7b72", ...],\n  "pathColor": "#f0f6fc"\n}'}
              rows={6}
              spellCheck={false}
            />
            {error && <div className="ai-error">{error}</div>}

            {/* Live swatch preview */}
            {parsed && (
              <div className="ai-preview">
                <span className="ai-preview-bg" style={{ background: parsed.bg }}>
                  <span className="ai-preview-maze" style={{ background: parsed.maze }} />
                </span>
                <div className="ai-preview-swatches">
                  {swatchColors.map((c, i) => (
                    <span key={i} className="ai-preview-dot" style={{ background: c }} />
                  ))}
                  {parsed.pathColor && (
                    <span
                      className="ai-preview-dot ai-preview-path"
                      style={{ background: parsed.pathColor }}
                      title="Path color"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="ai-actions">
            <button className="ai-cancel-btn" onClick={onClose}>Cancel</button>
            <button
              className="ai-apply-btn"
              onClick={() => parsed && onApply(parsed)}
              disabled={!parsed}
            >
              Apply palette
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AIPaletteModal;
