-- SEFKHET-ABWY database schema.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run again: every statement is "if not exists" or "or replace".
--
-- Holds the Dutch national monuments (rijksmonumenten), imported from the
-- Rijksdienst voor het Cultureel Erfgoed (RCE) by scripts/import-monuments.js.
-- Source licence: CC-BY 4.0.

-- PostGIS, for positions and distance queries. Supabase keeps extensions in
-- their own schema.
create extension if not exists postgis with schema extensions;
set search_path = public, extensions;

create table if not exists public.monuments (
  id              text primary key,                -- RCE object number (PDOK "localid")
  monument_number integer not null,                -- rijksmonumentnummer, as shown in the register
  name            text,
  address         text,
  place           text,
  category        text,
  designated_on   date,                            -- date of entry in the register
  register_url    text not null,                   -- page in the official register
  location        geography(Point, 4326) not null, -- longitude, latitude (WGS 84)
  last_seen_at    timestamptz not null default now() -- last import that still contained it
);

create index if not exists monuments_location_idx on public.monuments using gist (location);
create index if not exists monuments_number_idx on public.monuments (monument_number);
create index if not exists monuments_last_seen_idx on public.monuments (last_seen_at);

-- Everyone may read; nobody may write through the public API. The import
-- script uses the secret key (service_role), which bypasses Row Level Security.
-- The grants are explicit so this does not depend on the project's defaults.
grant select on public.monuments to anon, authenticated;
grant select, insert, update, delete on public.monuments to service_role;

alter table public.monuments enable row level security;

drop policy if exists "Monuments are public" on public.monuments;
create policy "Monuments are public" on public.monuments
  for select to anon, authenticated using (true);

-- Monuments within radius_m metres of a point, nearest first.
-- The radius is capped at 5 km and the result at 500 rows, so one request
-- can never return a whole city.
create or replace function public.monuments_near(
  lat double precision,
  lon double precision,
  radius_m double precision default 2000,
  max_results integer default 300
)
returns table (
  id text,
  monument_number integer,
  name text,
  address text,
  place text,
  category text,
  register_url text,
  latitude double precision,
  longitude double precision,
  distance_m double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select m.id, m.monument_number, m.name, m.address, m.place, m.category, m.register_url,
         st_y(m.location::geometry) as latitude,
         st_x(m.location::geometry) as longitude,
         st_distance(m.location, p.here) as distance_m
  from public.monuments m,
       (select st_setsrid(st_makepoint(lon, lat), 4326)::geography as here) p
  where st_dwithin(m.location, p.here, least(greatest(radius_m, 0), 5000))
  order by m.location <-> p.here
  limit least(greatest(max_results, 1), 500);
$$;

grant execute on function public.monuments_near(double precision, double precision, double precision, integer)
  to anon, authenticated, service_role;
