import { useEffect } from 'react';

/**
 * Details of the monument tapped on the map. Most monuments have no name in
 * the register, so the type ("Woonhuis") stands in as the title.
 */
export default function MonumentCard({ monument, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = monument.name || monument.type || 'Rijksmonument';
  const kind = monument.name ? monument.type : null;
  const street = [kind, monument.address].filter(Boolean).join(' · ');

  return (
    <section className="monument-card" aria-label={`Monument: ${title}`}>
      <button type="button" className="monument-close" onClick={onClose} aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      <h2>{title}</h2>
      {street && <p>{street}</p>}
      {monument.place && <p>{monument.place}</p>}
      <p className="monument-link">
        <a href={monument.url} target="_blank" rel="noreferrer">
          Rijksmonument {monument.number} ↗
        </a>
      </p>
    </section>
  );
}
