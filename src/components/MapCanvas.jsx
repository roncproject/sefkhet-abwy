import { useEffect, useRef, useState } from 'react';
import { loadArcgis, createBasemap } from './arcgis.js';
import LocationReadout from './LocationReadout.jsx';

/** Zoom level that frames a position of the given accuracy (metres). */
function zoomFor(location) {
  if (location.phase === 'device') {
    const a = location.accuracy ?? 100;
    if (a <= 50) return 17;
    if (a <= 250) return 16;
    if (a <= 1000) return 14;
    if (a <= 5000) return 12;
    return 11;
  }
  return 12;  // network or fallback: city scale
}

const INK = [0, 0, 0, 1];
const PAPER = [255, 255, 255, 1];

/** Map symbols for the current position, in the app's black-on-white palette. */
function positionGraphics(m, loc) {
  if (loc.phase !== 'device' && loc.phase !== 'network') return [];
  const centre = new m.Point({ longitude: loc.longitude, latitude: loc.latitude });
  const graphics = [];

  if (loc.phase === 'device') {
    if (loc.accuracy) {
      graphics.push(new m.Graphic({
        geometry: new m.Circle({
          center: centre, radius: loc.accuracy, radiusUnit: 'meters',
          geodesic: true, numberOfPoints: 96,
        }),
        symbol: {
          type: 'simple-fill', color: [0, 0, 0, 0.08],
          outline: { color: [0, 0, 0, 0.85], width: 1 },
        },
      }));
    }
    // Solid dot: the device reported this position itself.
    graphics.push(new m.Graphic({
      geometry: centre,
      symbol: { type: 'simple-marker', style: 'circle', size: 15, color: INK,
                outline: { color: PAPER, width: 3 } },
    }));
  } else {
    // Hollow ring: an estimate from the network, not a measured position.
    graphics.push(new m.Graphic({
      geometry: centre,
      symbol: { type: 'simple-marker', style: 'circle', size: 26, color: [255, 255, 255, 0.35],
                outline: { color: INK, width: 2 } },
    }));
    graphics.push(new m.Graphic({
      geometry: centre,
      symbol: { type: 'simple-marker', style: 'circle', size: 5, color: INK,
                outline: { color: PAPER, width: 1 } },
    }));
  }
  return graphics;
}

/** Map symbols for a public places result, in the app's black-on-white palette. */
function placeGraphics(m, places) {
  return places.map((p) => new m.Graphic({
    geometry: new m.Point({ longitude: p.longitude, latitude: p.latitude }),
    attributes: { id: p.id, name: p.name, kind: p.kind },
    symbol: {
      type: 'simple-marker', style: 'square', size: 9,
      color: INK, outline: { color: PAPER, width: 1.5 },
    },
  }));
}

/**
 * Fetches /api/places for the view's current centre and replaces the layer's
 * contents. Called whenever the view becomes stationary (see the
 * reactiveUtils.watch below) — never on every frame, per the documentation's
 * guidance in section 5.5. Aborts a still-inflight request before starting
 * the next one, so a quick pan can't resolve out of order.
 */
async function fetchPlaces(m, view, layer, abortRef) {
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;

  const { latitude, longitude } = view.center;
  try {
    const res = await fetch(`/api/places?lat=${latitude}&lon=${longitude}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { places } = await res.json();
    layer.removeAll();
    layer.addMany(placeGraphics(m, places ?? []));
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Failed to load nearby places:', err);
  }
}

export default function MapCanvas({ location }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const layerRef = useRef(null);
  const placesLayerRef = useRef(null);
  const placesAbortRef = useRef(null);
  const modulesRef = useRef(null);
  const locationRef = useRef(location);
  const centredOnRef = useRef(null);     // which phase the map was last centred on
  const userMovedRef = useRef(false);    // stop auto-centring once the user pans

  const [status, setStatus] = useState('waiting'); // waiting | loading | ready | error
  const [attempt, setAttempt] = useState(0);
  const [offline, setOffline] = useState(() => !navigator.onLine);

  locationRef.current = location;
  const haveCentre = location.phase !== 'locating';

  // Start downloading the SDK straight away, while the location is resolved.
  useEffect(() => { loadArcgis().catch(() => {}); }, []);

  // Track connectivity; retry automatically when the connection comes back.
  useEffect(() => {
    const on = () => { setOffline(false); setAttempt((n) => n + 1); };
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Build the map once there is somewhere to centre it.
  useEffect(() => {
    if (!haveCentre || !containerRef.current) return undefined;
    let cancelled = false;
    let view = null;
    const handles = [];
    setStatus('loading');

    loadArcgis()
      .then((m) => {
        if (cancelled) return;
        modulesRef.current = m;
        const loc = locationRef.current;

        const layer = new m.GraphicsLayer({ title: 'Your position', listMode: 'hide' });
        layerRef.current = layer;

        const placesLayer = new m.GraphicsLayer({ title: 'Nearby places', listMode: 'hide' });
        placesLayerRef.current = placesLayer;

        view = new m.MapView({
          container: containerRef.current,
          // placesLayer first so the position dot always draws on top of it.
          map: new m.Map({ basemap: createBasemap(m), layers: [placesLayer, layer] }),
          center: [loc.longitude, loc.latitude],
          zoom: zoomFor(loc),
          constraints: { minZoom: 3, maxZoom: 19, rotationEnabled: false, snapToZoom: true },
          popupEnabled: false,
          // Remove the SDK's default zoom widget (deprecated); this app draws its own.
          ui: { components: [] },
        });
        viewRef.current = view;
        centredOnRef.current = loc.phase;
        userMovedRef.current = false;
        layer.addMany(positionGraphics(m, loc));

        // Once the user starts exploring, stop pulling the map back to them.
        handles.push(m.reactiveUtils.watch(() => view.interacting, (on) => {
          if (on) userMovedRef.current = true;
        }));
        handles.push(view.on('mouse-wheel', () => { userMovedRef.current = true; }));
        handles.push(view.on('key-down', () => { userMovedRef.current = true; }));

        // Nearby places, refetched each time the view settles rather than on
        // every frame while panning or zooming.
        handles.push(m.reactiveUtils.watch(
          () => view.stationary,
          (stationary) => { if (stationary) fetchPlaces(m, view, placesLayer, placesAbortRef); },
        ));

        return view.when(() => { if (!cancelled) setStatus('ready'); });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Map failed to load:', err);
        setStatus('error');
      });

    // React unmounts on hot reload and in StrictMode: release the WebGL context.
    return () => {
      cancelled = true;
      handles.forEach((h) => h?.remove?.());
      placesAbortRef.current?.abort();
      if (view) view.destroy();
      viewRef.current = null;
      layerRef.current = null;
      placesLayerRef.current = null;
      centredOnRef.current = null;
    };
  }, [haveCentre, attempt]);

  // Keep the position symbol current, and move to a better fix when one arrives.
  useEffect(() => {
    const view = viewRef.current;
    const layer = layerRef.current;
    const m = modulesRef.current;
    if (!view || !layer || !m || status !== 'ready') return;

    layer.removeAll();
    layer.addMany(positionGraphics(m, location));

    const upgrade = location.phase === 'device' && centredOnRef.current !== 'device';
    const firstFix = centredOnRef.current === 'fallback' && location.phase === 'network';
    if ((upgrade || firstFix) && !userMovedRef.current) {
      centredOnRef.current = location.phase;
      view.goTo(
        { center: [location.longitude, location.latitude], zoom: zoomFor(location) },
        { duration: 1200 },
      ).catch(() => {});
    }
  }, [location, status]);

  function recentre() {
    location.relocate();
    const view = viewRef.current;
    if (!view || location.latitude == null) return;
    userMovedRef.current = false;
    centredOnRef.current = location.phase;
    view.goTo(
      { center: [location.longitude, location.latitude], zoom: Math.max(view.zoom, zoomFor(location)) },
      { duration: 700 },
    ).catch(() => {});
  }

  function zoomBy(step) {
    const view = viewRef.current;
    if (!view) return;
    view.goTo({ zoom: Math.round(view.zoom) + step }, { duration: 250 }).catch(() => {});
  }

  const showCover = status !== 'ready';
  let coverText = 'Locating';
  if (haveCentre && status === 'loading') coverText = 'Loading map';
  if (status === 'error') {
    coverText = offline
      ? 'You are offline. The map loads when the connection is back.'
      : 'The map could not load. Check your connection and try again.';
  }

  return (
    <div className="map-shell">
      <div
        ref={containerRef}
        className="map-canvas"
        role="application"
        aria-label="Map centred on your location. Use arrow keys to pan and plus or minus to zoom."
      />

      {showCover && (
        <div className="map-cover" role="status" aria-live="polite">
          <p className={status === 'error' ? 'cover-text' : 'cover-text is-busy'}>{coverText}</p>
          {status === 'error' && !offline && (
            <button type="button" className="text-button" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          )}
        </div>
      )}

      {status === 'ready' && (
        <>
          <LocationReadout location={location} />
          <div className="map-controls" role="group" aria-label="Map controls">
            <button type="button" className="icon-button" onClick={recentre}
                    aria-label="Centre on my location" title="Centre on my location">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            <button type="button" className="icon-button" onClick={() => zoomBy(1)}
                    aria-label="Zoom in" title="Zoom in">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            <button type="button" className="icon-button" onClick={() => zoomBy(-1)}
                    aria-label="Zoom out" title="Zoom out">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M5 12h14" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
