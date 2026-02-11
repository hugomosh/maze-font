import MazeGenerator from './components/MazeGenerator';
import StrokeTest from './components/StrokeTest';
import './App.css'

const TEST_MODE = true; // Set to false to return to normal view

const ALL_CHARS = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ?!/ -+|_.,;@#$%&*'.split('');

function App() {

  return (
    <div className="App">
      {TEST_MODE ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 10 }}>
          {ALL_CHARS.map(char => (
            <StrokeTest key={char} char={char} />
          ))}
        </div>
      ) : (
        <MazeGenerator />
      )}
    </div>
  )
}

export default App