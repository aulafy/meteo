# Construye una demo SaaS geoespacial con APIs e IA

Ruta técnica en español basada en el código real de
[Aulafy METEO](https://github.com/aulafy/meteo). No es una receta para copiar una
pantalla terminada: reconstruye el sistema por capas y obliga a verificar cada una
antes de añadir la siguiente.

## Qué construirás

Una aplicación React y TypeScript que:

- representa datos GeoJSON en un mapa MapLibre;
- consulta meteorología, terremotos y fuentes públicas;
- separa navegador, funciones servidor y tareas programadas;
- guarda suscripciones consentidas en Supabase/PostGIS;
- genera una explicación limitada con IA sin delegarle decisiones críticas;
- se despliega con previews y producción diferenciadas;
- estima costes y prepara límites antes de invitar usuarios.

METEO usa incendios y emergencias como dominio exigente. El patrón técnico puede
adaptarse a movilidad, turismo, logística, energía, agricultura o mantenimiento,
pero la demo **no sustituye a 112, ES-Alert ni a una autoridad**.

## Nivel y tiempo

- Público: desarrollo frontend o full-stack con conocimientos básicos de
  JavaScript, terminal, HTTP y Git.
- Duración orientativa: 14–20 horas, más el proyecto final.
- Requisitos: Node.js compatible con el repositorio, navegador moderno y Git.
- Para las primeras cinco etapas no necesitas Supabase, Vercel ni una clave de IA.

## Ruta paso a paso

| Etapa | Resultado comprobable | Tiempo | Servicios de pago necesarios |
|---|---|---:|---|
| [0. Producto y límites](00-producto-y-arquitectura.md) | alcance, arquitectura y definición de demo | 60 min | ninguno |
| [1. Entorno local](01-entorno-local.md) | app, tests y build reproducibles | 45 min | ninguno |
| [2. Primer mapa](02-primer-mapa.md) | mapa con una fuente y una capa propia | 90 min | ninguno |
| [3. APIs públicas](03-apis-publicas.md) | datos validados con estados de error | 120 min | ninguno para aprendizaje no comercial |
| [4. Análisis geoespacial](04-analisis-geoespacial.md) | distancia, tiempo y confianza verificables | 120 min | ninguno |
| [5. Backend serverless](05-backend-serverless.md) | secretos y proxy fuera del navegador | 100 min | no para desarrollo local |
| [6. Supabase y PostGIS](06-supabase-postgis.md) | persistencia, RLS y consulta espacial | 150 min | plan gratuito durante aprendizaje |
| [7. IA acotada](07-ia-acotada.md) | explicación validada, limitada y apagable | 120 min | consumo de API si se activa |
| [8. Demo SaaS](08-demo-saas.md) | niveles de producto y presupuesto de uso | 90 min | ninguno para diseñar |
| [9. Vercel](09-despliegue-vercel.md) | preview, producción y rollback | 90 min | depende de uso y frecuencia |
| [10. Escala segura](10-costes-seguridad-escala.md) | threat model, límites y calculadora | 150 min | ninguno para diseñar |
| [11. Proyectos](11-proyectos-finales.md) | una variante propia con evidencias | 4–8 h | depende de la variante |

## Cómo estudiar cada etapa

1. Lee solo el resultado y los conceptos.
2. Implementa los pasos en una rama nueva.
3. Ejecuta la prueba indicada antes de mirar el archivo final enlazado.
4. Compara tu solución con el repositorio; no la sustituyas automáticamente.
5. Completa el bloque «Evidencia» con comandos, captura o resultado.
6. Anota el coste por usuario y el peor abuso plausible antes de conectar un
   proveedor externo.

## Mapa del código final

```text
navegador React
  ├─ MapLibre + GeoJSON                 src/App.tsx y src/features/*
  ├─ Open-Meteo y búsqueda              src/services.ts
  ├─ USGS y Bombers                     src/features/*/service.ts
  └─ llamadas propias /api/*
          ├─ validación y rate limit     api/_lib.ts
          ├─ DGT y normalización         api/dgt-incidents.ts
          ├─ explicación de IA           api/ai-guidance.ts
          └─ alertas y cron              api/subscriptions.ts + api/cron/*
                    └─ Supabase/PostGIS  supabase/migrations/*
```

## Conexiones con Aulafy

- [Supabase con RLS](https://www.aulafy.net/cursos/crear-webs-con-ia/supabase-rls)
- [Seguridad, privacidad y límites legales](https://www.aulafy.net/cursos/crear-webs-con-ia/seguridad-privacidad-legal)
- [Vercel: preview y producción](https://www.aulafy.net/cursos/crear-webs-con-ia/vercel-preview-produccion)
- [Chatbot con clave protegida](https://www.aulafy.net/cursos/crear-webs-con-ia/chatbot-groq-seguro)
- [Landing y aplicación SaaS](https://www.aulafy.net/cursos/crear-webs-con-ia/taller-app-saas)

## Regla económica del curso

«Tiene plan gratuito» no significa «puede atender gratis a cualquier número de
usuarios». En cada etapa debes responder:

```text
coste mensual ≈ usuarios activos × acciones por usuario × coste por acción
               + almacenamiento + transferencia + cómputo fijo
```

La matriz de proveedores, límites y fuentes oficiales está en
[Costes, seguridad y escala](10-costes-seguridad-escala.md). Sus cifras llevan
fecha porque pueden cambiar.

