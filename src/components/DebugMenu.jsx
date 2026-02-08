import React from 'react';
import './DebugMenu.css';

const DebugMenu = ({ showFrames, toggleShowFrames }) => {
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
    </div>
  );
};

export default DebugMenu;
