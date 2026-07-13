create extension if not exists postgis with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint_hash text unique not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  latitude double precision not null check (latitude between 35 and 44),
  longitude double precision not null check (longitude between -10 and 5),
  location extensions.geography(point, 4326) generated always as (extensions.st_point(longitude, latitude)::extensions.geography) stored,
  radius_km integer not null default 25 check (radius_km between 5 and 100),
  consent_version text not null,
  consented_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_location_idx on public.push_subscriptions using gist(location);
alter table public.push_subscriptions enable row level security;

create table if not exists public.alert_deliveries (
  id bigint generated always as identity primary key,
  delivery_key text unique not null,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  fire_id text not null,
  distance_km double precision not null,
  status text not null check (status in ('sent', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.alert_deliveries enable row level security;

comment on table public.push_subscriptions is 'Ubicaciones consentidas para alertas. Solo accesible mediante service role.';
comment on table public.alert_deliveries is 'Registro auditable y deduplicado de avisos enviados.';
