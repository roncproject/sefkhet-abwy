/**
 * GET /api/places?lat=..&lon=.. — public places within 2000 m of a point.
 *
 * Pattern B (documentation section 5.2): the Supabase secret key is read
 * here, server-side, and never reaches the browser. The `places_near` RPC
 * is declared `security invoker` in Postgres, so Row Level Security still
 * applies to its results — this endpoint can only ever surface rows where
 * `is_public` is true, regardless of what the secret key could otherwise see.
 */
import { createClient } from '@supabase/supabase-js';

const RADIUS_M = 2000;

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

export async function GET(request) {
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get('lat'));
  const lon = Number(u.searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  const { data, error } = await db.rpc('places_near', { lat, lon, radius_m: RADIUS_M });

  // The Postgres error (table/column names) stays in the function log; the
  // client gets a generic message. See documentation section 5.5, "Error surface".
  if (error) {
    console.error('[api/places] places_near failed:', error);
    return Response.json({ error: 'Lookup failed' }, { status: 502 });
  }

  return Response.json(
    { places: data },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } },
  );
}
