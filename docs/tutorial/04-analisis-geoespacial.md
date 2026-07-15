# 4. Convierte coordenadas en análisis verificable

## Resultado

Calcularás distancia, antigüedad, dirección relativa y una puntuación orientativa
sin pedir a la IA que haga matemáticas ni geografía crítica.

## 1. Normaliza el orden de coordenadas

GeoJSON usa `[longitud, latitud]`. Muchas interfaces humanas muestran primero
latitud. Mezclarlas puede desplazar un punto miles de kilómetros sin producir un
error de TypeScript.

```ts
type Coordinates = [longitude: number, latitude: number];
```

Valida además el ámbito de la aplicación. METEO acepta un rectángulo amplio para
España y después filtra la geometría cuando corresponde.

## 2. Mide sobre la esfera

No uses distancia euclídea entre grados. Con Turf:

```ts
import distance from '@turf/distance';
import { point } from '@turf/helpers';

const km = distance(point(a), point(b), { units: 'kilometers' });
```

Para consultas persistentes, PostGIS usa `geography(Point, 4326)` y `ST_DWithin`.
El navegador sirve para interacción; la base de datos evita descargar miles de
puntos para compararlos uno a uno.

## 3. Filtra antes de puntuar

El orden importa:

```text
validar → limitar al territorio → descartar futuro → filtrar antigüedad
→ filtrar confianza → calcular distancia → ordenar → puntuar
```

Una observación con doce horas y un minuto no se vuelve «reciente» porque esté
cerca. Conserva los umbrales como reglas explícitas y pruébalas en el borde.

## 4. Separa señal, interpretación y acción

- Señal: punto térmico FIRMS, hora, confianza, FRP.
- Interpretación: distancia y contexto meteorológico.
- Acción: consultar 112, ES-Alert y fuentes oficiales.

METEO no transforma automáticamente una actuación de Bombers en un foco FIRMS ni
una huella quemada EFFIS en un frente activo. Fuentes diferentes miden cosas
diferentes.

## 5. Prueba propiedades, no solo ejemplos felices

- la distancia de un punto consigo mismo es cero;
- intercambiar `a` y `b` no cambia la distancia;
- una observación futura se rechaza;
- justo el límite temporal se comporta como se documenta;
- bajar la confianza no puede aumentar la prioridad;
- sin meteorología, la evaluación se marca incompleta;
- sin ubicación elegida, no hay distancia «personal».

Consulta `src/services.test.ts`, `src/geolibre-analysis.test.ts` y los selectores de
features para ver el patrón final.

## 6. Exporta sin filtrar GPS

Una exportación GeoJSON útil para depuración puede incluir las fuentes públicas y
la ruta local importada, pero no debe añadir automáticamente la posición precisa de
la persona. Diseña una lista explícita de propiedades permitidas.

## Evidencia

```bash
npm test -- src/services.test.ts src/geolibre-analysis.test.ts
```

Añade al menos una prueba que falle al invertir latitud y longitud. Explica en el
commit por qué el resultado es de apoyo y no un riesgo oficial.

