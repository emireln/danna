import '@fontsource-variable/inter';
import '@fontsource-variable/unbounded';
import './styles/app.css';
import './styles/frame.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('danna could not start: the page is missing its root element.');

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
