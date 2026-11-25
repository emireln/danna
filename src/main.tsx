import '@fontsource-variable/inter';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/nunito';
import './styles/app.css';
import './styles/frame.css';
import './styles/library.css';
import './styles/system.css';
import './styles/controls.css';
import './styles/coach.css';
import './styles/live.css';
import './styles/looks.css';
import './styles/decks.css';
import './styles/write.css';
import './styles/define.css';
import './styles/tour.css';
import './styles/playful.css';
import './styles/design.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { initLang } from './lib/i18n';

initLang();
const root = document.getElementById('root');
if (!root) throw new Error('Danna could not start: the page is missing its root element.');

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
