/**
 * Imports all current Dutch national monuments (rijksmonumenten) into Supabase.
 *
 *   npm run import:monuments            fetch, write, remove withdrawn monuments
 *   npm run import:monuments -- --dry-run   fetch and report only, write nothing
 *
 * Sources, both from the Rijksdienst voor het Cultureel Erfgoed (RCE), CC-BY 4.0:
 * - PDOK WFS: the current register, one point per monument (~64 pages of 1000).
 * - RCE Linked Data SPARQL: name, address and original function, one query per page.
 *
 * It is a full sync. Every monument found is upserted with the same last_seen_at;
 * afterwards, rows not seen in this run are deleted. If the run found far fewer
 * monuments than the table holds, something went wrong upstream and the delete
 * is skipped.
 *
 * Needs SUPABASE_URL and SUPABASE_SECRET_KEY, from .env.local or the environment.
 */
import { createClient } from '@supabase/supabase-js';

const PDOK_URL = 'https://service.pdok.nl/rce/ps-ch/wfs/v1_0';
const SPARQL_URL = 'https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/services/cho/sparql';
const PAGE_SIZE = 1000; // PDOK's maximum per request
const MIN_SHARE_FOR_DELETE = 0.95;
const USER_AGENT = 'sefkhet-abwy monument import (https://github.com/roncproject/sefkhet-abwy)';

const dryRun = process.argv.includes('--dry-run');

try {
  process.loadEnvFile('.env.local');
} catch {
  // No file: on GitHub Actions the variables come from the environment.
}

async function fetchWithRetry(url, options = {}, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { 'User-Agent': USER_AGENT, ...options.headers },
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
      return await res.json();
    } catch (err) {
      if (attempt >= attempts) throw err;
      const wait = 2 ** attempt * 1000;
      console.warn(`  ${err.message}; retrying in ${wait / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

/**
 * The page of monuments after `afterId`, in localid order. PDOK refuses a
 * startIndex above 50,000, so pages are selected by id rather than by offset.
 */
function fetchPdokPage(afterId) {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'ps-ch:rce_inspire_points',
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    sortBy: 'localid',
    count: String(PAGE_SIZE),
  });
  if (afterId) {
    params.set(
      'filter',
      '<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsGreaterThan>' +
        `<fes:ValueReference>localid</fes:ValueReference><fes:Literal>${afterId}</fes:Literal>` +
        '</fes:PropertyIsGreaterThan></fes:Filter>',
    );
  }
  return fetchWithRetry(`${PDOK_URL}?${params}`);
}

/** Name, address, place and function for a page of monuments, keyed by object number. */
async function fetchDetails(objectNumbers) {
  const values = objectNumbers
    .map((n) => `<https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/${n}>`)
    .join(' ');
  const query = `
    PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?m (SAMPLE(?naam) AS ?name) (MIN(?adres) AS ?address) (SAMPLE(?woonplaats) AS ?place)
           (SAMPLE(?gemeente) AS ?municipality) (SAMPLE(?functie) AS ?category)
    WHERE {
      VALUES ?m { ${values} }
      OPTIONAL { ?m ceo:heeftNaam/ceo:naam ?naam }
      OPTIONAL {
        ?m ceo:heeftBasisregistratieRelatie ?br .
        OPTIONAL { ?br ceo:gemeentenaam ?gemeente }
        OPTIONAL {
          ?br ceo:heeftBAGRelatie ?bag .
          ?bag ceo:volledigAdres ?adres .
          OPTIONAL { ?bag ceo:woonplaatsnaam ?woonplaats }
        }
      }
      OPTIONAL {
        ?m ceo:heeftOorspronkelijkeFunctie ?f .
        ?f ceo:hoofdfunctie true ; ceo:heeftFunctieNaam/skos:prefLabel ?functie .
      }
    }
    GROUP BY ?m`;
  const json = await fetchWithRetry(SPARQL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ query }),
  });
  const details = new Map();
  for (const b of json.results.bindings) {
    const objectNumber = b.m.value.split('/').pop();
    details.set(objectNumber, {
      name: b.name?.value ?? null,
      address: b.address?.value ?? null,
      place: b.place?.value ?? b.municipality?.value ?? null,
      // Labels carry a register code such as "Woonhuis(K)", "Winkel (G2)" or "Brug (TFU)".
      category: b.category?.value.replace(/\s*\([A-Z]+\d*\)\s*$/, '') ?? null,
    });
  }
  return details;
}

function toRow(feature, details, seenAt) {
  const p = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;
  const objectNumber = String(parseInt(p.localid, 10));
  const monumentNumber = parseInt(p.ciCitation.split('/').pop(), 10);
  if (!Number.isInteger(monumentNumber) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  const d = details.get(objectNumber) ?? {};
  return {
    id: p.localid,
    monument_number: monumentNumber,
    name: d.name ?? null,
    address: d.address ?? null,
    place: d.place ?? null,
    category: d.category ?? null,
    designated_on: p.legalfoundationdate || null,
    register_url: p.ciCitation,
    location: `SRID=4326;POINT(${lon} ${lat})`,
    last_seen_at: seenAt,
  };
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!dryRun && (!SUPABASE_URL || !SUPABASE_SECRET_KEY)) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see .env.local)');
  }
  const supabase = dryRun
    ? null
    : createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

  const seenAt = new Date().toISOString();
  const rows = new Map();
  let skipped = 0;

  let fetched = 0;
  for (let afterId = null; ; ) {
    const page = await fetchPdokPage(afterId);
    const features = page.features ?? [];
    if (features.length === 0) break;
    fetched += features.length;
    afterId = features.at(-1).properties.localid;

    const objectNumbers = [...new Set(features.map((f) => parseInt(f.properties.localid, 10)))];
    const details = await fetchDetails(objectNumbers);
    const batch = [];
    for (const feature of features) {
      const row = toRow(feature, details, seenAt);
      if (!row) skipped++;
      else if (!rows.has(row.id)) {
        rows.set(row.id, row);
        batch.push(row);
      }
    }

    if (!dryRun && batch.length > 0) {
      const { error } = await supabase.from('monuments').upsert(batch, { onConflict: 'id' });
      if (error) throw new Error(`Upsert failed: ${error.message}`);
    }
    console.log(`${String(fetched).padStart(6)} fetched, ${rows.size} monuments`);
    if (features.length < PAGE_SIZE) break;
  }

  const all = [...rows.values()];
  const share = (key) => `${Math.round((100 * all.filter((r) => r[key]).length) / all.length)}%`;
  console.log(
    `\n${all.length} monuments (${skipped} skipped). ` +
      `With name ${share('name')}, address ${share('address')}, place ${share('place')}, type ${share('category')}.`,
  );

  if (dryRun) {
    console.log('Dry run: nothing written.');
    return;
  }

  const { count: total, error: countError } = await supabase
    .from('monuments')
    .select('id', { count: 'exact', head: true });
  if (countError) throw new Error(`Count failed: ${countError.message}`);
  const stale = total - all.length;

  if (all.length < MIN_SHARE_FOR_DELETE * total) {
    console.error(
      `Only ${all.length} of ${total} monuments found; not deleting the ${stale} unseen rows. ` +
        'Check the sources and run again.',
    );
    process.exitCode = 1;
    return;
  }
  if (stale > 0) {
    const { error } = await supabase.from('monuments').delete().lt('last_seen_at', seenAt);
    if (error) throw new Error(`Delete failed: ${error.message}`);
  }
  console.log(`Removed ${Math.max(stale, 0)} monuments no longer in the register. Done.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
