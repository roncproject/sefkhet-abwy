import { useCallback, useEffect, useState } from 'react';
import TopBar from './components/TopBar.jsx';
import MapCanvas from './components/MapCanvas.jsx';
import InfoPanel from './components/InfoPanel.jsx';
import { PAGES, pageFromPath } from './content.jsx';
import { useDeviceLocation } from './location/useDeviceLocation.js';

const SITE = 'SEKHMET.QUEST';

/**
 * The whole application: a full-screen map, a top bar with the menu, and an
 * optional panel for About, Legal or Contact.
 *
 * The panels have real URLs (/about, /legal, /contact) so they can be linked
 * to and survive a reload; vercel.json rewrites them to index.html.
 */
export default function App() {
  const [page, setPage] = useState(() => pageFromPath(window.location.pathname));
  const location = useDeviceLocation();

  useEffect(() => {
    const onPop = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = page ? `${PAGES[page].title} | ${SITE}` : `${SITE} Map`;
  }, [page]);

  const navigate = useCallback((id) => {
    const path = id ? `/${id}` : '/';
    if (window.location.pathname !== path) {
      window.history.pushState({ inApp: true }, '', path);
    }
    setPage(id);
  }, []);

  const closePanel = useCallback(() => {
    // If the panel was opened from the menu, step back so the browser's Back
    // button doesn't reopen it. If it was opened from a direct link, replace.
    if (window.history.state?.inApp) {
      window.history.back();
    } else {
      window.history.replaceState(null, '', '/');
      setPage(null);
    }
  }, []);

  return (
    <div className="app">
      <TopBar current={page} onNavigate={navigate} />
      <main className="stage">
        <MapCanvas location={location} />
        {page && <InfoPanel page={page} onClose={closePanel} />}
      </main>
    </div>
  );
}
