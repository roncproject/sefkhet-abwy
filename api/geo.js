/**
 * GET /api/geo — approximate location of the visitor, derived from their IP.
 *
 * This is the only server-side code left in the application. It replaces the
 * Java 17 / Spring Boot backend, which served the React shell and a REST API
 * that the map never called. It exists as a *fallback*: the browser's own
 * Geolocation API (GPS, Wi-Fi, cell) is always preferred, but it can be slow,
 * refused by the user, or unsupported. This endpoint answers in milliseconds
 * with a city-level position so the map can open near the right place while
 * the precise fix is still on its way.
 *
 * Vercel's edge network adds the x-vercel-ip-* headers to every request that
 * reaches a Function. Nothing is looked up, stored or logged here; the values
 * are read from the request and echoed back.
 *
 * When the headers are absent (local development, or a plan or region where
 * Vercel does not supply them) the response is { available: false } and the
 * app falls back to its default map centre.
 */

const NO_STORE = {
  'Content-Type': 'application/json; charset=utf-8',
  // The answer is different for every visitor, so no shared cache may keep it.
  'Cache-Control': 'private, no-store, max-age=0',
};

/** Header values such as the city name are URL-encoded by Vercel. */
function decode(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function GET(request) {
  const h = request.headers;
  const latitude = Number.parseFloat(h.get('x-vercel-ip-latitude'));
  const longitude = Number.parseFloat(h.get('x-vercel-ip-longitude'));

  const valid =
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;

  const body = valid
    ? {
        available: true,
        source: 'ip',
        latitude,
        longitude,
        city: decode(h.get('x-vercel-ip-city')),
        region: decode(h.get('x-vercel-ip-country-region')),
        country: h.get('x-vercel-ip-country'),
      }
    : { available: false, source: 'ip' };

  return new Response(JSON.stringify(body), { status: 200, headers: NO_STORE });
}
