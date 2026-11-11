import '@fontsource-variable/inter';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { bridge } from './lib/bridge';

// The custom title bar on Windows reserves room for the native window controls.
if (bridge) {
  bridge
    .info()
    .then((info) => {
      if (info.platform === 'win32') document.documentElement.dataset.desktop = '';
    })
    .catch(() => undefined);
}

const root = document.getElementById('root');
if (!root) throw new Error('danna could not find its root element.');

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
