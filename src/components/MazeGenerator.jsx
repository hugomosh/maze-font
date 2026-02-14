import React, { useState, useRef, useLayoutEffect, useMemo } from 'react';
import SvgGrid, { CHAR_CELL_WIDTH_UNITS, CHAR_CELL_HEIGHT_UNITS, UNIT_SIZE_EXPORT } from './SvgGrid';
import './MazeGenerator.css';

const MazeGenerator = () => {
  const [text, setText] = useState('Hello');
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
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
    if (!gridSize.width || !gridSize.height) return 0;

    const charCellWidthPx = CHAR_CELL_WIDTH_UNITS * UNIT_SIZE_EXPORT;
    const charCellHeightPx = CHAR_CELL_HEIGHT_UNITS * UNIT_SIZE_EXPORT;

    const charsPerGridRow = Math.floor(gridSize.width / charCellWidthPx);
    const numGridRows = Math.floor(gridSize.height / charCellHeightPx);

    return charsPerGridRow * numGridRows;
  }, [gridSize.width, gridSize.height]);

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
      </div>
      <div className="grid-container" ref={gridRef}>
        <SvgGrid width={gridSize.width} height={gridSize.height} text={text} />
      </div>
    </div>
  );
};

export default MazeGenerator;

