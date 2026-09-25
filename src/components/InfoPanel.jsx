import { useEffect, useRef } from 'react';
import { PAGES } from '../content.jsx';

/**
 * A sheet over the map for About, Legal and Contact. The map stays mounted
 * underneath, so closing the panel returns to exactly the same view without
 * reloading tiles or asking for the location again.
 */
export default function InfoPanel({ page, onClose }) {
  const headingRef = useRef(null);
  const { title, Body } = PAGES[page];

  useEffect(() => {
    headingRef.current?.focus();
    const onKey = (e) => {
      // Let the menu handle its own Escape first.
      if (e.key === 'Escape' && !document.querySelector('.menu-button.is-open')) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [page, onClose]);

  return (
    <aside className="panel" aria-labelledby="panel-title">
      <div className="panel-head">
        <h1 id="panel-title" ref={headingRef} tabIndex={-1}>{title}</h1>
        <button type="button" className="text-button" onClick={onClose}>Close</button>
      </div>
      <div className="panel-body prose">
        <Body />
      </div>
    </aside>
  );
}
