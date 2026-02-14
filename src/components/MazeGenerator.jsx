import React, { useState, useRef, useLayoutEffect, useMemo } from 'react';
import SvgGrid, { CHAR_CELL_WIDTH_UNITS, CHAR_CELL_HEIGHT_UNITS, UNIT_SIZE_EXPORT } from './SvgGrid';
import './MazeGenerator.css';

const MazeGenerator = () => {
  const [text, setText] = useState('Jonathan');
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const [showPath, setShowPath] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('square'); // 'square' or 'story'
  const gridRef = useRef(null);

  useLayoutEffect(() => {
    if (!gridRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setGridSize({ width, height });
    });

    resizeObserver.observe(gridRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  const maxCharacters = useMemo(() => {
    // With dynamic sizing, we can be more generous with the character limit
    // Set a reasonable max for names (most names fit in 15 characters)
    return 20;
  }, []);

  const handleInputChange = (event) => {
    if (event.target.value.length <= maxCharacters) {
      setText(event.target.value);
    }
  };

  return (
    <div className="maze-generator">
      <div className="input-container">
        <input
          type="text"
          value={text}
          onChange={handleInputChange}
          placeholder="Enter your message..."
        />
        <div className="character-counter">
          {text.length} / {maxCharacters}
        </div>
        <label className="path-toggle">
          <input
            type="checkbox"
            checked={showPath}
            onChange={(e) => setShowPath(e.target.checked)}
          />
          <span>Show Path</span>
        </label>
      </div>
      <div className="format-selector">
        <button
          className={aspectRatio === 'square' ? 'active' : ''}
          onClick={() => setAspectRatio('square')}
        >
          Square (Post)
        </button>
        <button
          className={aspectRatio === 'story' ? 'active' : ''}
          onClick={() => setAspectRatio('story')}
        >
          Story (9:16)
        </button>
      </div>
      <div className="grid-container-wrapper">
        <div className={`grid-container ${aspectRatio}`} ref={gridRef}>
          <SvgGrid width={gridSize.width} height={gridSize.height} text={text} showPath={showPath} />
        </div>
      </div>
    </div>
  );
};

export default MazeGenerator;

