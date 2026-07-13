alter table public.push_subscriptions drop constraint if exists push_subscriptions_latitude_check;
alter table public.push_subscriptions drop constraint if exists push_subscriptions_longitude_check;
alter table public.push_subscriptions add constraint push_subscriptions_latitude_check check (latitude between 27 and 44.5);
alter table public.push_subscriptions add constraint push_subscriptions_longitude_check check (longitude between -19 and 5);

create table if not exists public.fire_observations (
  id bigint generated always as identity primary key,
  source text not null check (source in ('NASA FIRMS')),
  source_id text not null,
  latitude double precision not null check (latitude between 27 and 44.5),
  longitude double precision not null check (longitude between -19 and 5),
  location extensions.geography(point, 4326) generated always as (extensions.st_point(longitude, latitude)::extensions.geography) stored,
  confidence smallint not null check (confidence between 0 and 100),
  intensity smallint not null check (intensity between 0 and 100),
  frp double precision check (frp is null or frp >= 0),
  detected_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists fire_observations_location_idx on public.fire_observations using gist(location);
create index if not exists fire_observations_detected_at_idx on public.fire_observations(detected_at desc);
alter table public.fire_observations enable row level security;

create table if not exists public.ingestion_runs (
  id bigint generated always as identity primary key,
  source text not null,
  status text not null check (status in ('ok', 'error')),
  item_count integer not null default 0 check (item_count >= 0),
  source_generated_at timestamptz,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists ingestion_runs_created_at_idx on public.ingestion_runs(created_at desc);
alter table public.ingestion_runs enable row level security;

create or replace function public.pending_alert_candidates(
  minimum_confidence integer default 70,
  observed_since timestamptz default now() - interval '12 hours'
)
returns table (
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  fire_id text,
  distance_km double precision,
  detected_at timestamptz,
  confidence smallint,
  frp double precision
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    subscriptions.id,
    subscriptions.endpoint,
    subscriptions.p256dh,
    subscriptions.auth,
    nearest.source_id,
    extensions.st_distance(subscriptions.location, nearest.location) / 1000.0,
    nearest.detected_at,
    nearest.confidence,
    nearest.frp
  from public.push_subscriptions as subscriptions
  join lateral (
    select observations.*
    from public.fire_observations as observations
    where observations.detected_at >= observed_since
      and observations.detected_at <= now()
      and observations.confidence >= minimum_confidence
      and extensions.st_dwithin(
        subscriptions.location,
        observations.location,
        subscriptions.radius_km * 1000.0
      )
    order by subscriptions.location <-> observations.location
    limit 1
  ) as nearest on true
  where subscriptions.active = true
    and subscriptions.last_seen_at >= now() - interval '180 days'
    and not exists (
      select 1
      from public.alert_deliveries as deliveries
      where deliveries.subscription_id = subscriptions.id
        and deliveries.fire_id = nearest.source_id
        and deliveries.status = 'sent'
    );
$$;

revoke all on function public.pending_alert_candidates(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.pending_alert_candidates(integer, timestamptz) to service_role;

comment on table public.fire_observations is 'Observaciones FIRMS normalizadas. No constituyen incendios confirmados.';
comment on table public.ingestion_runs is 'Trazabilidad de las ingestas automáticas de fuentes externas.';
comment on function public.pending_alert_candidates is 'Selecciona en PostGIS la detección reciente más próxima a cada suscripción consentida.';
