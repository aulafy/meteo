# 3. Consume APIs públicas sin confiar ciegamente

## Resultado

Conectarás Open-Meteo y USGS, validarás respuestas y diseñarás estados de carga,
vacío, error y dato antiguo.

## 1. Escribe el contrato que necesitas

No tipifiques toda la respuesta del proveedor. Define el subconjunto que consume la
interfaz:

```ts
type Weather = {
  available: boolean;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
};
```

Un tipo TypeScript no valida JSON en ejecución. Comprueba existencia, rango y fecha
antes de convertir una respuesta externa en estado de producto.

## 2. Construye una URL explícita

```ts
const params = new URLSearchParams({
  latitude: String(latitude),
  longitude: String(longitude),
  current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m',
  timezone: 'Europe/Madrid',
});

const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
```

Comprueba `response.ok`; captura timeouts y abortos; no conviertas un fallo en cero
grados o cero viento.

## 3. Separa adapter y dominio

```text
JSON del proveedor → validar → normalizar unidades → tipo interno → interfaz
```

Así, un cambio de nombre del proveedor solo modifica el adapter. En METEO este
recorrido vive en `src/services.ts` y los adapters de cada feature.

## 4. Usa GeoJSON cuando la fuente lo ofrezca

USGS publica un `FeatureCollection`. Aun así valida:

- `geometry.type === "Point"`;
- longitud y latitud finitas;
- fecha válida;
- magnitud dentro de un rango razonable;
- URL oficial con protocolo HTTPS;
- identificador estable para deduplicar.

Consulta `src/features/earthquakes/service.ts` y sus pruebas después de implementar
tu versión.

## 5. Diseña todos los estados

| Estado | Mensaje correcto | Error peligroso |
|---|---|---|
| cargando | «Consultando Open-Meteo…» | mostrar último valor sin fecha |
| vacío | «No hay elementos en esta selección» | «No existe ningún incidente» |
| error | «Fuente no disponible temporalmente» | rellenar con un valor simulado |
| antiguo | «Actualizado hace 3 h» | presentarlo como tiempo real |
| parcial | «Falta meteorología; evaluación incompleta» | calcular como si el dato fuera 0 |

## 6. Controla frecuencia y caché

Si 1.000 usuarios consultan tres endpoints cada minuto:

```text
1.000 × 3 × 60 × 24 = 4.320.000 solicitudes/día
```

Una caché compartida de cinco minutos puede convertir muchas solicitudes iguales en
una sola consulta del backend. Agrupa variables compatibles, evita polling con la
pestaña oculta y aplica backoff después de un fallo.

## Coste y licencia

La API gratuita de Open-Meteo es para uso no comercial y tiene límites publicados.
Una demo SaaS con suscripción, publicidad o finalidad comercial necesita revisar un
plan comercial o autoalojamiento. La atribución de los datos sigue siendo necesaria.

Consulta siempre la versión vigente de
[precios](https://open-meteo.com/en/pricing) y
[términos](https://open-meteo.com/en/terms) antes de publicar.

## Prompt para Codex

```text
Revisa este adapter de una API pública.
Comprueba: timeout, response.ok, validación en ejecución, unidades, fechas, rangos,
respuesta vacía, caché, atribución, datos personales enviados y coste con 1.000,
10.000 y 100.000 usuarios activos. No modifiques archivos todavía. Devuelve riesgos
priorizados y pruebas concretas.
```

## Evidencia

Escribe pruebas con una respuesta válida, vacía, 429, 500, JSON inválido y fecha
imposible. La interfaz debe diferenciar cada caso sin fabricar datos.

