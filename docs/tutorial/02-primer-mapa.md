# 2. Construye el primer mapa con MapLibre

## Resultado

Crearás un mapa, una fuente GeoJSON y dos capas visuales. Entenderás la diferencia
entre la biblioteca que renderiza y el proveedor que entrega teselas.

## 1. Instala el motor

```bash
npm install maplibre-gl
```

MapLibre GL JS es la biblioteca TypeScript/WebGL. No incluye por sí sola un mapa
mundial alojado. El estilo de METEO usa OpenFreeMap; en otro producto podrías usar
otro proveedor o autoalojar teselas.

## 2. Reserva el contenedor

```tsx
const mapContainer = useRef<HTMLDivElement>(null);
const mapRef = useRef<maplibregl.Map | null>(null);

return <div ref={mapContainer} className="map" aria-label="Mapa de contexto" />;
```

El contenedor necesita altura CSS explícita. Una pantalla vacía suele ser un
problema de tamaño, estilo remoto o WebGL, no de coordenadas.

## 3. Crea y destruye una sola instancia

```tsx
useEffect(() => {
  if (!mapContainer.current || mapRef.current) return;

  const map = new maplibregl.Map({
    container: mapContainer.current,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [-3.7, 40.4],
    zoom: 4.7,
  });
  mapRef.current = map;

  return () => {
    map.remove();
    mapRef.current = null;
  };
}, []);
```

La limpieza evita workers, listeners y contextos WebGL duplicados durante recargas.

## 4. Añade datos, no marcadores sueltos

```ts
map.addSource('observaciones', {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: [] },
});

map.addLayer({
  id: 'observaciones-calor',
  type: 'heatmap',
  source: 'observaciones',
  paint: { 'heatmap-radius': 22, 'heatmap-opacity': 0.65 },
});

map.addLayer({
  id: 'observaciones-puntos',
  type: 'circle',
  source: 'observaciones',
  paint: { 'circle-radius': 5, 'circle-color': '#f97316' },
});
```

Una fuente representa datos; una capa decide cómo dibujarlos. Puedes reutilizar la
misma fuente para círculos, etiquetas y calor sin duplicar el feed.

## 5. Actualiza sin reconstruir el mapa

```ts
const source = map.getSource('observaciones') as maplibregl.GeoJSONSource;
source.setData(featureCollection);
```

Usa identificadores estables. Antes de `addSource` o `addLayer`, comprueba si ya
existen para evitar errores durante cambios de estilo.

## 6. Añade procedencia y accesibilidad

- conserva la atribución de OpenStreetMap/OpenFreeMap;
- ofrece la información esencial también como lista HTML;
- no codifiques gravedad solo mediante color;
- respeta movimiento reducido en animaciones;
- muestra fuente, actualización y significado de cada símbolo.

La documentación oficial de MapLibre explica también las directivas CSP necesarias:
[MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/).

## Coste y dependencia

OpenFreeMap declara actualmente su instancia pública gratuita y sin límites, pero
se ofrece «tal cual» y sin garantía. Para una demo pequeña puede ser adecuada; una
empresa debe diseñar sustitución, patrocinio o autoalojamiento. La biblioteca
MapLibre puede ser gratuita mientras el alojamiento de teselas y la transferencia
siguen siendo costes operativos.

Fuentes: [OpenFreeMap](https://openfreemap.org/) y
[términos](https://openfreemap.org/tos/).

## Evidencia

- [ ] aparece el mapa tras recargar cinco veces;
- [ ] no se duplican fuentes ni workers;
- [ ] la lista HTML permite entender los puntos sin depender del mapa;
- [ ] la atribución permanece visible;
- [ ] al bloquear el dominio de teselas aparece un estado comprensible.

