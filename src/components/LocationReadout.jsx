import { useState } from 'react';

function formatCoord(value, positive, negative) {
  return `${Math.abs(value).toFixed(5)}° ${value >= 0 ? positive : negative}`;
}

function formatDistance(metres) {
  if (metres < 1000) return `${Math.max(1, Math.round(metres))} m`;
  return `${(metres / 1000).toFixed(metres < 10000 ? 1 : 0)} km`;
}

const HINTS = {
  denied: 'Location access is blocked for this site. Allow it in the browser’s site settings, then press the locate button.',
  insecure: 'The browser only shares location over HTTPS or on localhost.',
  unsupported: 'This browser does not share its location.',
  unavailable: 'The device could not work out its position. On Windows, check that Location services are on.',
  timeout: 'The device took too long to find its position.',
};

/**
 * The live position readout, pinned to the bottom-left of the map:
 * coordinates first, then where they came from and how far to trust them.
 */
export default function LocationReadout({ location }) {
  const [collapsed, setCollapsed] = useState(false);
  const { phase, latitude, longitude, accuracy, place, problem } = location;

  let source;
  if (phase === 'device') {
    source = accuracy ? `Device location, within ${formatDistance(accuracy)}` : 'Device location';
  } else if (phase === 'network') {
    source = `Approximate, from your internet connection${place ? ` (${place})` : ''}`;
  } else if (!problem) {
    // Nothing has failed yet: most likely the permission prompt is still open.
    source = `Waiting for your device’s location. Showing ${place || 'the default area'} for now.`;
  } else {
    source = `Location unavailable. Showing ${place || 'the default area'}.`;
  }

  const hint = phase !== 'device' && problem ? HINTS[problem] : null;
  const hasFix = phase === 'device' || phase === 'network';

  return (
    <section className={collapsed ? 'readout is-collapsed' : 'readout'} aria-label="Your position">
      <button type="button" className="readout-toggle" onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}>
        {collapsed ? 'Show position' : 'Hide'}
      </button>
      {!collapsed && (
        <div aria-live="polite">
          {hasFix && (
            <p className="readout-coords">
              <span>{formatCoord(latitude, 'N', 'S')}</span>
              <span>{formatCoord(longitude, 'E', 'W')}</span>
            </p>
          )}
          <p className="readout-source">{source}</p>
          {hint && <p className="readout-hint">{hint}</p>}
        </div>
      )}
    </section>
  );
}
