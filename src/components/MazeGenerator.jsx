import React, { useState, useRef, useLayoutEffect, useMemo } from 'react';
import SvgGrid, { CHAR_CELL_WIDTH_UNITS, CHAR_CELL_HEIGHT_UNITS, UNIT_SIZE_EXPORT } from './SvgGrid';
import './MazeGenerator.css';

const MazeGenerator = () => {
  const [text, setText] = useState('Jonathan');
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const [showPath, setShowPath] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('square'); // 'square' or 'story'
  const [sizingMode, setSizingMode] = useState('autofit'); // 'standard', 'autofit', 'compact'
  const gridRef = useRef(null);
  const svgRef = useRef(null);

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

  const handleShare = async () => {
    if (!svgRef.current) return;

    try {
      // Get the SVG element
      const svgElement = svgRef.current;
      const svgData = new XMLSerializer().serializeToString(svgElement);

      // Create a canvas to convert SVG to PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Set canvas size to match SVG
      canvas.width = svgElement.width.baseVal.value;
      canvas.height = svgElement.height.baseVal.value;

      // Create an image from the SVG data
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // Draw the image on canvas
        ctx.drawImage(img, 0, 0);

        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
          const link = document.createElement('a');
          const fileName = text ? `maze-${text.replace(/\s+/g, '-').toLowerCase()}.png` : 'maze.png';
          link.download = fileName;
          link.href = URL.createObjectURL(blob);
          link.click();

          // Cleanup
          URL.revokeObjectURL(url);
          URL.revokeObjectURL(link.href);
        });
      };

      img.src = url;
    } catch (error) {
      console.error('Error downloading image:', error);
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
        <button className="share-button" onClick={handleShare}>
          Share
        </button>
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
      <div className="format-selector sizing-mode-selector">
        <button
          className={sizingMode === 'standard' ? 'active' : ''}
          onClick={() => setSizingMode('standard')}
          title="Fixed cell size, original layout"
        >
          Standard
        </button>
        <button
          className={sizingMode === 'autofit' ? 'active' : ''}
          onClick={() => setSizingMode('autofit')}
          title="Scale cells to fit text perfectly"
        >
          Autofit
        </button>
        <button
          className={sizingMode === 'compact' ? 'active' : ''}
          onClick={() => setSizingMode('compact')}
          title="Reduce grid padding for mobile"
        >
          Compact
        </button>
      </div>
      <div className="grid-container-wrapper">
        <div className={`grid-container ${aspectRatio} ${sizingMode === 'compact' ? 'compact-mode' : ''}`} ref={gridRef}>
          <SvgGrid ref={svgRef} width={gridSize.width} height={gridSize.height} text={text} showPath={showPath} sizingMode={sizingMode} />
        </div>
      </div>
    </div>
  );
};

export default MazeGenerator;

