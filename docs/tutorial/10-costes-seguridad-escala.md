# 10. Costes, seguridad y escala

**Última revisión de cifras y condiciones:** 15 de julio de 2026. Verifica cada
fuente oficial antes de publicar: los planes cambian.

## Resultado

Crearás una hoja de presupuesto, un threat model y una decisión explícita de
continuar, limitar o desactivar cada función externa.

## 1. Matriz de proveedores

| Componente | Para aprender | Qué escala | Advertencia de producción |
|---|---|---|---|
| MapLibre GL JS | biblioteca open source | JavaScript y GPU del cliente | el motor no paga las teselas |
| OpenFreeMap | instancia pública actualmente gratuita | vistas y teselas | sin SLA; servicio «tal cual»; prepara proveedor alternativo o autoalojamiento |
| Open-Meteo | gratis para uso no comercial con límites | llamadas y variables solicitadas | una demo SaaS comercial necesita plan comercial o autoalojamiento; atribución obligatoria |
| NASA FIRMS | `MAP_KEY` gratuita | transacciones por ventana | 5.000 transacciones/10 min publicadas; una consulta grande puede contar varias |
| USGS, EFFIS, DGT, Bombers | fuentes públicas | polling y volumen | disponibilidad y cobertura no equivalen a SLA de producto |
| Vercel | preview y frontend | invocaciones, CPU, memoria, transferencia, logs | cron frecuente no cabe en Hobby; WAF y límites deben configurarse |
| Supabase | aprendizaje y piloto pequeño | cómputo, egress, disco, funciones | cada proyecto añade cómputo; Spend Cap no cubre todos los conceptos |
| Groq | pruebas con cuota o saldo disponible | tokens de entrada/salida | precios y modelos cambian; fija salida y presupuesto |
| Web Push | navegador/proveedor push | suscripciones y entregas | el coste principal aparece en DB, cron, logs, soporte y privacidad |

Fuentes oficiales:

- [OpenFreeMap](https://openfreemap.org/) y [términos](https://openfreemap.org/tos/)
- [Open-Meteo pricing](https://open-meteo.com/en/pricing) y [terms](https://open-meteo.com/en/terms)
- [NASA FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/)
- [Vercel pricing](https://vercel.com/docs/pricing), [Functions](https://vercel.com/docs/functions/usage-and-pricing) y [Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Supabase usage](https://supabase.com/docs/guides/platform/manage-your-usage) y [cost control](https://supabase.com/docs/guides/platform/cost-control)
- [Groq pricing](https://groq.com/pricing)

## 2. Calcula tres escenarios

Para cada función estima 1.000, 10.000 y 100.000 usuarios activos al mes.

```text
llamadas = usuarios × sesiones/usuario × acciones/sesión × reintentos
egress GB = llamadas × respuesta media en bytes / 1.000.000.000
tokens = solicitudes IA × (entrada media + salida máxima)
cron = ejecuciones/día × días × operaciones por ejecución
```

Incluye un escenario de abuso: un bot llama a IA 10 veces por segundo durante una
hora. El presupuesto debe indicar qué capa lo corta antes de consumir cuota.

## 3. Amenazas prioritarias

| Amenaza | Impacto | Controles mínimos |
|---|---|---|
| clave en bundle | consumo fraudulento y acceso privilegiado | servidor, rotación, escaneo de secretos |
| endpoint IA abierto | factura, saturación, salida dañina | Zod, rate limit distribuido, tokens máximos, WAF, kill switch |
| abuso del cron | duplicados y notificaciones masivas | secreto, idempotencia, lock, deduplicación |
| GPS en logs | exposición de datos personales | minimización, redacción, retención, acceso restringido |
| `service_role` filtrada | acceso total a Supabase | gestor de secretos, funciones estrechas, rotación inmediata |
| prompt injection en dato externo | instrucciones falsas | tratar fuentes como datos, no como instrucciones; salida acotada |
| feed antiguo o manipulado | decisiones incorrectas | fecha, firma/HTTPS cuando exista, validación, fuentes redundantes |
| dependencia gratuita caída | producto inutilizable | caché, fallback, proveedor alternativo, modo degradado |

## 4. Presupuesto con límites técnicos

No basta una cifra en una hoja. Conecta cada presupuesto a una acción:

| Umbral | Acción automática | Acción humana |
|---|---|---|
| 50% | aviso interno | revisar tendencia |
| 75% | reducir frecuencia o caché más larga | aprobar ampliación o limitar piloto |
| 90% | desactivar IA para anónimos | decidir gasto adicional |
| 100% | kill switch de la función no esencial | análisis y comunicación |

Las alertas de emergencia deterministas no deben depender del mismo interruptor que
una explicación IA opcional.

## 5. Privacidad por diseño

- ubicación precisa solo tras acción y consentimiento claros;
- finalidad única y radio visible;
- sin nombre o email si Web Push no los necesita;
- botón de eliminación que borra servidor y estado local;
- retención ejecutada por código y comprobada;
- proveedores y transferencias documentados;
- canal privado para incidentes;
- evaluación jurídica antes de uso público, especialmente con menores o decisiones
  que afecten seguridad.

## 6. Puerta de producción

No abras un piloto amplio hasta poder responder «sí»:

- [ ] ¿Hay límites distribuidos en endpoints costosos?
- [ ] ¿Hay presupuesto, alertas y kill switch probados?
- [ ] ¿Las claves se pueden rotar sin cambiar el frontend?
- [ ] ¿La baja elimina la ubicación?
- [ ] ¿El cron es idempotente y compatible con el plan?
- [ ] ¿Se distinguen dato, cálculo, IA y autoridad?
- [ ] ¿Los fallos de proveedor producen modo degradado seguro?
- [ ] ¿Existe responsable de operación y canal de incidentes?
- [ ] ¿Se probó carga con datos no personales?
- [ ] ¿La documentación legal describe el sistema real?

## Evidencia

Entrega una tabla con escenarios, la regla WAF/rate limit, una captura de alertas de
presupuesto y el resultado de activar el kill switch en preview.

