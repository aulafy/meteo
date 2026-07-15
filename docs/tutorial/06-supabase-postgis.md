# 6. Guarda alertas con Supabase, RLS y PostGIS

## Resultado

Crearás tablas sin lectura pública, almacenarás una suscripción consentida y
seleccionarás observaciones cercanas con `ST_DWithin`.

## 1. Reduce los datos antes de crear tablas

Para una alerta Web Push no hacen falta nombre, email ni teléfono. METEO conserva:

- endpoint y material criptográfico de Web Push;
- latitud, longitud y radio consentidos;
- versión y fecha del consentimiento;
- fechas técnicas para renovación y borrado;
- observaciones y entregas necesarias para deduplicar.

Menos columnas significan menos exposición, egress y obligaciones de mantenimiento.

## 2. Aplica las migraciones en orden

```text
supabase/migrations/001_push_alerts.sql
supabase/migrations/002_fire_observations.sql
```

No copies solo las tablas. Las restricciones, índices, RLS, revocaciones y función
espacial forman parte del modelo de seguridad.

## 3. Usa `geography` para metros reales

```sql
location extensions.geography(point, 4326)
  generated always as (
    extensions.st_point(longitude, latitude)::extensions.geography
  ) stored
```

El índice GiST y `ST_DWithin` permiten filtrar cerca de cada suscripción sin enviar
todas las ubicaciones al servidor de aplicación.

## 4. Entiende qué significa RLS aquí

Todas las tablas tienen RLS activa y no ofrecen políticas a `anon` ni
`authenticated`. El navegador no accede directamente. Las funciones servidor usan
`service_role`, que evita RLS y por eso tiene máximo privilegio.

Consecuencias:

- nunca coloques `service_role` en `VITE_*`;
- valida autorización y entrada antes de cada operación;
- limita las columnas que se insertan o actualizan;
- no conviertas una función servidor en proxy SQL genérico;
- prueba que la clave pública no puede seleccionar las tablas.

## 5. Protege funciones `security definer`

La RPC fija `search_path`, valida parámetros y revoca ejecución pública. Revisa
siempre estos puntos; una función privilegiada sin `search_path` controlado puede
resolver objetos inesperados.

## 6. Diseña retención y eliminación

El sistema actual elimina suscripciones inactivas, observaciones y auditorías según
ventanas documentadas. El botón de baja debe borrar servidor y navegador. Una
política escrita que ningún proceso ejecuta no es retención real.

## 7. Coste de la base de datos

Supabase cobra componentes distintos: plan, cómputo por proyecto, egress, disco,
funciones y otros usos. El Spend Cap de planes compatibles reduce algunos excesos,
pero no cubre todos los conceptos, incluido cierto cómputo. Revisa el panel de uso y
la documentación vigente:

- [Control de costes](https://supabase.com/docs/guides/platform/cost-control)
- [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
- [Cómputo](https://supabase.com/docs/guides/platform/manage-your-usage/compute)

Una consulta espacial indexada y una respuesta con pocas columnas cuestan menos que
descargar miles de filas y filtrar en cada función.

## Pruebas antes de publicar

- [ ] `anon` no puede leer ni escribir las tablas;
- [ ] una ubicación fuera del ámbito falla;
- [ ] el radio fuera de rango falla;
- [ ] dos altas del mismo endpoint no crean duplicados;
- [ ] una baja elimina la ubicación;
- [ ] una detección antigua o de baja confianza no genera candidato;
- [ ] la misma detección no se entrega dos veces;
- [ ] los jobs de retención eliminan solo datos vencidos.

Consulta [el documento de backend](../supabase-backend.md) para el flujo final.

