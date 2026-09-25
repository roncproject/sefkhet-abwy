/**
 * useDeviceLocation — where does this device think it is?
 *
 * Three sources, best first:
 *
 *   1. device   The browser Geolocation API. The operating system decides how
 *               to answer: GPS on phones, Wi-Fi positioning on laptops, cell
 *               towers, or a mix. Needs the user's permission and a secure
 *               context (HTTPS, or http://localhost during development).
 *   2. network  /api/geo — a city-level position from the visitor's IP
 *               address, supplied by Vercel. Fast, no permission prompt, but
 *               often several kilometres off (and wrong behind a VPN).
 *   3. fallback The default centre, when neither source answers.
 *
 * Both lookups start at the same time. Whichever answers first opens the map;
 * a device fix always replaces a network position when it arrives. The device
 * position keeps updating as the user moves (watchPosition).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Rotterdam: the original app's map centre. */
export const DEFAULT_CENTRE = { latitude: 51.9244, longitude: 4.4777, place: 'Rotterdam' };

/** Wait this long for any answer before opening the map at the default centre. */
const FALLBACK_AFTER_MS = 5000;
/** Give the IP lookup this long before giving up on it. */
const NETWORK_TIMEOUT_MS = 4000;

const WATCH_OPTIONS = { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 };

const PROBLEM_BY_CODE = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };

const INITIAL = {
  phase: 'locating',        // 'locating' | 'device' | 'network' | 'fallback'
  latitude: null,
  longitude: null,
  accuracy: null,           // metres (device only)
  place: null,              // "Rotterdam, NL" (network and fallback)
  problem: null,            // why the device position is missing, if it is
  updatedAt: null,
};

function placeName(city, country) {
  return [city, country].filter(Boolean).join(', ') || null;
}

export function useDeviceLocation() {
  const [state, setState] = useState(INITIAL);
  const failed = useRef({ device: false, network: false });
  const watchId = useRef(null);

  const toFallback = useCallback(() => {
    setState((prev) =>
      prev.phase === 'locating'
        ? { ...prev, phase: 'fallback', ...DEFAULT_CENTRE, accuracy: null, updatedAt: Date.now() }
        : prev);
  }, []);

  const onDevicePosition = useCallback((pos) => {
    const { latitude, longitude, accuracy } = pos.coords;
    setState({
      phase: 'device', latitude, longitude,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      place: null, problem: null, updatedAt: pos.timestamp || Date.now(),
    });
  }, []);

  const onDeviceError = useCallback((err) => {
    const problem = PROBLEM_BY_CODE[err?.code] || 'unavailable';
    // A timeout during watchPosition is not final: the watch keeps running and
    // may still deliver. Only a refusal ends it.
    if (problem === 'denied' && watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setState((prev) => (prev.phase === 'device' ? prev : { ...prev, problem }));
    failed.current.device = true;
    if (failed.current.network) toFallback();
  }, [toFallback]);

  const startWatch = useCallback(() => {
    if (!window.isSecureContext) {
      setState((prev) => ({ ...prev, problem: 'insecure' }));
      failed.current.device = true;
      return false;
    }
    if (!('geolocation' in navigator)) {
      setState((prev) => ({ ...prev, problem: 'unsupported' }));
      failed.current.device = true;
      return false;
    }
    if (watchId.current === null) {
      watchId.current = navigator.geolocation.watchPosition(
        onDevicePosition, onDeviceError, WATCH_OPTIONS);
    }
    return true;
  }, [onDevicePosition, onDeviceError]);

  useEffect(() => {
    failed.current = { device: false, network: false };
    startWatch();

    // IP-based position in parallel.
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
    fetch('/api/geo', { cache: 'no-store', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((geo) => {
        if (!geo?.available) throw new Error('No IP location');
        setState((prev) => (prev.phase === 'device' ? prev : {
          ...prev, phase: 'network',
          latitude: geo.latitude, longitude: geo.longitude, accuracy: null,
          place: placeName(geo.city, geo.country), updatedAt: Date.now(),
        }));
      })
      .catch(() => {
        failed.current.network = true;
        if (failed.current.device) toFallback();
      })
      .finally(() => clearTimeout(abortTimer));

    const fallbackTimer = setTimeout(toFallback, FALLBACK_AFTER_MS);

    return () => {
      controller.abort();
      clearTimeout(abortTimer);
      clearTimeout(fallbackTimer);
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [startWatch, toFallback]);

  /**
   * Ask for a fresh device fix now (the Locate button). If the user refused
   * earlier, most browsers answer "denied" again immediately; the UI then
   * explains how to re-enable location in the browser.
   */
  const relocate = useCallback(() => {
    if (!startWatch()) return;
    navigator.geolocation.getCurrentPosition(onDevicePosition, onDeviceError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  }, [startWatch, onDevicePosition, onDeviceError]);

  return { ...state, relocate };
}
