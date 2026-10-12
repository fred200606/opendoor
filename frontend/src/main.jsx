import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Fonts from the Figma design, served by OpenDoor itself (no calls to a font service).
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/lexend/600.css';
import '@fontsource/lexend/700.css';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import './index.css';
import { applyDisplayPrefs, loadDisplayPrefs } from './lib/displayPrefs.js';

applyDisplayPrefs(loadDisplayPrefs());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
