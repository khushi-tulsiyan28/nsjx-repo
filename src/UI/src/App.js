import React, { useState } from 'react';
import Settings from './pages/settings';
import Git from './pages/git';
import RepositoryEvents from './components/RepositoryEvents';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('settings');

  return (
    <div className="App">
      <nav className="nav">
        <a 
          href="#settings" 
          className={currentPage === 'settings' ? 'active' : ''}
          onClick={() => setCurrentPage('settings')}
        >
          Settings
        </a>
        <a 
          href="#git" 
          className={currentPage === 'git' ? 'active' : ''}
          onClick={() => setCurrentPage('git')}
        >
          Git
        </a>
        <a 
          href="#events" 
          className={currentPage === 'events' ? 'active' : ''}
          onClick={() => setCurrentPage('events')}
        >
          Repository Events
        </a>
      </nav>
      
      <div className="container">
        {currentPage === 'settings' && <Settings />}
        {currentPage === 'git' && <Git />}
        {currentPage === 'events' && <RepositoryEvents />}
      </div>
    </div>
  );
}

export default App; 