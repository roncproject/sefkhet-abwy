import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

// IBM Plex Mono, self-hosted: bundled from npm, served from the same origin and
// precached by the service worker, so the typeface also renders offline.
// These files carry unicode-range subsets; browsers fetch only what they need.
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles.css';

import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: installs the PWA and updates it silently in the background.
// Only active in production builds (npm run build, then npm run preview).
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}
