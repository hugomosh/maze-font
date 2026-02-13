import React from 'react';
import './DebugMenu.css';

const DebugMenu = ({ showFrames, toggleShowFrames, wordMazeMode, toggleWordMazeMode }) => {
  return (
    <div className="debug-menu">
      <label>
        <input
          type="checkbox"
          checked={showFrames}
          onChange={toggleShowFrames}
        />
        Show Frames
      </label>
      <label>
        <input
          type="checkbox"
          checked={wordMazeMode}
          onChange={toggleWordMazeMode}
        />
        Word Maze
      </label>
    </div>
  );
};

export default DebugMenu;
