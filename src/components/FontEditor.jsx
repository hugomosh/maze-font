import React, { useState, useCallback, useMemo } from 'react';
import initialFontData from '../assets/maze-font.json';
import { Undo2, Redo2, Trash2, Download, Upload } from 'lucide-react';
import GlyphEditor from './GlyphEditor';

// --- Helper Functions for Wall Format Conversion ---

const wallsToObjects = (walls) => {
  if (!walls) return [];
  return walls.map(([x1, y1, x2, y2]) => ({
    p1: { x: x1, y: y1 },
    p2: { x: x2, y: y2 },
  }));
};

const wallsFromObjects = (walls) => {
  return walls.map(wall => [wall.p1.x, wall.p1.y, wall.p2.x, wall.p2.y]);
};


const FontEditor = () => {
  const [fontData, setFontData] = useState(initialFontData);
  const [selectedChar, setSelectedChar] = useState('A');
  const [history, setHistory] = useState([initialFontData]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = (newData) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleEditEnd = () => {
    pushHistory(fontData);
  };

  const handleUpdateGlyph = (newWalls) => {
    const newFontData = {
      ...fontData,
      [selectedChar]: wallsFromObjects(newWalls),
    };
    setFontData(newFontData);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setFontData(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setFontData(history[newIndex]);
    }
  };

  const clearGlyph = () => {
    const newFontData = { ...fontData, [selectedChar]: [] };
    pushHistory(newFontData);
    setFontData(newFontData);
  };

  const handleExport = () => {
    const jsonString = JSON.stringify(fontData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'maze-font.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        // Basic validation could be added here
        pushHistory(importedData);
        setFontData(importedData);
      } catch (error) {
        console.error("Failed to parse font file:", error);
        alert("Invalid font file. Could not parse JSON.");
      }
    };
    reader.readAsText(file);
  };


  const currentGlyph = useMemo(() => ({
    char: selectedChar,
    walls: wallsToObjects(fontData[selectedChar]),
  }), [selectedChar, fontData]);

  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '1rem' }}>
      <div style={{ flex: '1' }}>
        <h2>Glyph Editor</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label htmlFor="char-selector">Character: </label>
            <input
              id="char-selector"
              type="text"
              value={selectedChar}
              onChange={(e) => setSelectedChar(e.target.value.toUpperCase())}
              maxLength="1"
              style={{ width: '40px', textAlign: 'center', fontSize: '1.5rem' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f1f1', padding: '0.5rem', borderRadius: '8px' }}>
            <button onClick={undo} disabled={historyIndex === 0} title="Undo"><Undo2 size={20} /></button>
            <button onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo"><Redo2 size={20} /></button>
            <button onClick={clearGlyph} title="Clear Glyph"><Trash2 size={20} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f1f1', padding: '0.5rem', borderRadius: '8px' }}>
            <button onClick={handleExport} title="Export Font"><Download size={20} /></button>
            <label htmlFor="import-font" style={{ cursor: 'pointer' }} title="Import Font">
              <Upload size={20} />
            </label>
            <input type="file" id="import-font" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </div>
        </div>

        <GlyphEditor
          key={selectedChar} // Re-mount component when char changes
          glyph={currentGlyph}
          onUpdate={handleUpdateGlyph}
          onEditEnd={handleEditEnd}
          char={selectedChar}
          fontData={fontData}
        />

        <div style={{ marginTop: '2rem' }}>
          <h3>Character Set</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', background: '#f8f8f8', padding: '1rem', borderRadius: '8px' }}>
            {Object.keys(fontData).sort().map(char => (
              <button
                key={char}
                onClick={() => setSelectedChar(char)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  background: selectedChar === char ? '#ddd' : '#fff',
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                }}
              >
                {char}
              </button>
            ))}
            <button
              onClick={() => {
                const newChar = prompt('Enter new character:');
                if (newChar && newChar.length === 1) {
                  const upperChar = newChar.toUpperCase();
                  if (fontData[upperChar]) {
                    alert(`Character "${upperChar}" already exists.`);
                  } else {
                    const newFontData = { ...fontData, [upperChar]: [] };
                    setFontData(newFontData);
                    setSelectedChar(upperChar);
                    pushHistory(newFontData);
                  }
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                border: '1px dashed #ccc',
                borderRadius: '4px',
                background: '#f0f0f0',
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>
      
      {/* We can add back the stroke visualization here later if needed */}
    </div>
  );
};

export default FontEditor;