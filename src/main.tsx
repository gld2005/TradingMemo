import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { FloatingWindow } from './app/FloatingWindow';
import './styles/tokens.css';
import './styles/global.css';

const isFloatingWindow = new URLSearchParams(window.location.search).get('window') === 'floating';
document.documentElement.dataset.window = isFloatingWindow ? 'floating' : 'main';
document.body.dataset.window = isFloatingWindow ? 'floating' : 'main';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isFloatingWindow ? <FloatingWindow /> : <App />}</StrictMode>,
);
