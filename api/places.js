/**
 * GET /api/places?lat=..&lon=.. — national monuments (rijksmonumenten) within
 * 2000 m of a point, nearest first, at most 300.
 *
 * Pattern B (documentation section 5.2): the Supabase secret key is read
 * here, server-side, and never reaches the browser. The `monuments_near` RPC
 * (supabase/schema.sql) caps the radius and the number of rows itself, so
 * this endpoint cannot be used to pull the whole table.
 */
import { createClient } from '@supabase/supabase-js';

const RADIUS_M = 2000;
const MAX_RESULTS = 300;

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

export async function GET(request) {
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get('lat'));
  const lon = Number(u.searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  const { data, error } = await db.rpc('monuments_near', {
    lat, lon, radius_m: RADIUS_M, max_results: MAX_RESULTS,
  });

  // The Postgres error (table/column names) stays in the function log; the
  // client gets a generic message. See documentation section 5.5, "Error surface".
  if (error) {
    console.error('[api/places] monuments_near failed:', error);
    return Response.json({ error: 'Lookup failed' }, { status: 502 });
  }

  const places = data.map((m) => ({
    id: m.id,
    number: m.monument_number,
    name: m.name,
    type: m.category,
    address: m.address,
    place: m.place,
    url: m.register_url,
    latitude: m.latitude,
    longitude: m.longitude,
  }));

  return Response.json(
    { places },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } },
  );
}
