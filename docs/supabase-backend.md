# Backend Supabase/PostGIS

## Objetivo

Supabase almacena únicamente la información necesaria para alertas 24/7: suscripción Web Push, ubicación consentida, radio elegido, observaciones FIRMS normalizadas y registro de entregas. El navegador no tiene acceso directo a estas tablas; todas tienen RLS activa y se operan exclusivamente desde funciones Vercel con `SUPABASE_SERVICE_ROLE_KEY`.

## Migraciones

Ejecuta en orden:

1. `supabase/migrations/001_push_alerts.sql`
2. `supabase/migrations/002_fire_observations.sql`

La segunda migración crea:

- `fire_observations`: observaciones FIRMS con columna `geography(Point, 4326)` e índices espacial/temporal.
- `ingestion_runs`: auditoría mínima de la fuente, fecha, resultado y número de elementos.
- `pending_alert_candidates`: función SQL protegida que usa `ST_DWithin` y distancia geodésica para seleccionar la detección reciente más próxima a cada suscripción.

También amplía las restricciones geográficas de la migración inicial para cubrir península, Baleares, Canarias, Ceuta y Melilla. El recolector FIRMS usa la frontera española de Natural Earth a escala 1:10m después de consultar el rectángulo nacional completo.

La función revoca acceso a `public`, `anon` y `authenticated`; solo `service_role` puede ejecutarla.

## Flujo del cron

1. Verifica `Authorization: Bearer $CRON_SECRET`.
2. Descarga y valida el feed FIRMS.
3. Hace `upsert` idempotente de observaciones en PostGIS.
4. Registra la ingesta.
5. Elimina datos vencidos según la política de retención.
6. Solicita candidatos a PostGIS con confianza mínima del 70% y antigüedad máxima de 12 horas.
7. Envía Web Push y registra únicamente las entregas completadas, de modo que un fallo transitorio pueda reintentarse.

## Orden seguro de despliegue

Aplica primero ambas migraciones y después despliega las funciones. Si se despliega el cron nuevo antes de `002_fire_observations.sql`, la evaluación devolverá error porque las tablas/RPC todavía no existen.

Variables de servidor requeridas:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CRON_SECRET`
- `FIRMS_FEED_URL`

Nunca uses `SUPABASE_SERVICE_ROLE_KEY` en variables `VITE_*` ni en el navegador.
