# 0. Define el producto antes del mapa

## Resultado

Crearás `docs/mi-demo.md` con un usuario concreto, una decisión útil, fuentes,
límites y criterios observables. También dibujarás qué ocurre en navegador,
servidor y base de datos.

## 1. Escribe el problema sin tecnología

Ejemplo METEO:

> Una persona en España quiere consultar contexto meteorológico y detecciones
> públicas cercanas, entender su antigüedad y abrir las fuentes oficiales sin
> confundir una demo con una alerta de emergencia.

No escribas todavía «quiero MapLibre, Supabase e IA». Son soluciones. Primero
define la decisión que ayudas a tomar y lo que **nunca** decidirá el sistema.

## 2. Clasifica cada afirmación

| Tipo | Ejemplo | Puede cambiarlo la IA |
|---|---|---|
| dato externo | humedad publicada por Open-Meteo | no |
| cálculo | distancia geodésica a una detección | no |
| regla de producto | ignorar observaciones antiguas | no |
| explicación | resumir datos ya calculados | sí, con límites |
| decisión oficial | evacuar, cerrar una carretera | nunca |

La IA se coloca al final porque una salida fluida no convierte una suposición en
un hecho.

## 3. Diseña tres zonas de confianza

```text
PÚBLICO / NAVEGADOR
mapa, preferencias locales, ubicación mientras se usa la interfaz

SERVIDOR / VERCEL FUNCTIONS
claves externas, validación, proxy, IA, límites y caché

DATOS SENSIBLES / SUPABASE
ubicación consentida, suscripción push, retención y auditoría mínima
```

Si un secreto aparece en una variable `VITE_*`, ya no es secreto: Vite lo incluye
en JavaScript descargable.

## 4. Decide qué versión vas a construir

| Versión | Incluye | No incluye |
|---|---|---|
| local | mapa, datos públicos, búsqueda y errores | cuentas, cron, alertas remotas |
| demo pública | frontend, funciones con límites, IA opcional | garantía, SLA, decisiones críticas |
| piloto | Supabase, consentimiento, alertas y observabilidad | escala masiva sin pruebas |
| producción crítica | redundancia, autoridad, auditoría y guardias | dependencia de una sola fuente |

No llames «MVP» a una versión que almacena GPS sin canal de eliminación.

## 5. Escribe criterios de aceptación

- [ ] Sin GPS, la app no presenta el centro del mapa como ubicación personal.
- [ ] Si una API falla, muestra «no disponible» y no inventa un valor.
- [ ] Cada dato indica fuente y momento de actualización.
- [ ] La clave de una API privada no aparece en el bundle del navegador.
- [ ] La IA no recibe el GPS preciso ni calcula el nivel de riesgo.
- [ ] La demo funciona con la IA y Supabase desactivados.
- [ ] Un enlace visible conduce a la fuente oficial o a una explicación de límites.

## Prompt para Codex

```text
Analiza mi idea de demo geoespacial sin escribir código.

OBJETIVO
Convertirla en una primera versión verificable.

ENTREGA
1. usuario y decisión principal;
2. datos necesarios con fuente y frecuencia;
3. datos personales implicados;
4. separación navegador/servidor/base de datos;
5. funciones excluidas;
6. diez criterios de aceptación;
7. tres riesgos de coste y tres de seguridad.

No inventes disponibilidad, licencias ni precios. Marca PENDIENTE cualquier dato
que deba verificarse en la documentación oficial.
```

## Evidencia

Antes de avanzar, otra persona debe poder leer `docs/mi-demo.md` y explicar qué
hará la primera versión, qué no hará y qué servicio puede generar costes.

