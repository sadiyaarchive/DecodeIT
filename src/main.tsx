import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installSimHost, isSimHostMode } from './lib/figma/dev';
import './index.css';

// Development only: stand in for the plugin code so every selection state can be tried in a plain
// browser tab (`?host=frame`, `?host=none`, ...). Not part of the plugin build.
if (import.meta.env.DEV) {
  const q = new URLSearchParams(window.location.search).get('host');
  installSimHost(isSimHostMode(q) ? q : 'off');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
