import { Activity, ChevronRight, ExternalLink } from 'lucide-react';
import type { Coordinates } from '../../types';
import { formatEarthquakeDistance, selectEarthquakesForSummary } from './selectors';
import type { Earthquake } from './types';

interface EarthquakeSummaryProps {
  earthquakes: Earthquake[];
  location: Coordinates | null;
  mode: 'loading' | 'live' | 'error';
  statusText: string;
  onSelect: (earthquake: Earthquake) => void;
  onShowLayer: () => void;
}

const formatDetectedAt = (detectedAt: string) => new Date(detectedAt).toLocaleString('es-ES', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function EarthquakeSummary({ earthquakes, location, mode, statusText, onSelect, onShowLayer }: EarthquakeSummaryProps) {
  const items = selectEarthquakesForSummary(location, earthquakes);
  const title = location ? 'Terremotos más cercanos' : 'Últimos terremotos';

  return <section className="panel-section earthquake-section">
    <div className="section-title">
      <div><h2>{title}</h2><span>USGS · 24 h · {statusText}</span></div>
      <button type="button" onClick={onShowLayer}>Ver capa</button>
    </div>
    {mode === 'error' && earthquakes.length === 0 && <p className="route-copy">USGS no está disponible. METEO no puede confirmar la actividad sísmica reciente.</p>}
    {mode === 'loading' && earthquakes.length === 0 && <p className="route-copy">Cargando el feed sísmico oficial…</p>}
    {mode === 'live' && items.length === 0 && <p className="route-copy">USGS no publica terremotos en el feed de las últimas 24 horas.</p>}
    <div className="earthquake-summary-list">
      {items.map(({ earthquake, distanceKm }) => <article className="earthquake-summary-row" key={earthquake.id}>
        <button type="button" onClick={() => onSelect(earthquake)} aria-label={`Ver terremoto de magnitud ${earthquake.magnitude.toFixed(1)} en ${earthquake.place}`}>
          <span className="earthquake-magnitude"><Activity aria-hidden="true"/><b>M{earthquake.magnitude.toFixed(1)}</b></span>
          <span className="earthquake-summary-copy"><b>{earthquake.place}</b><small>{formatDetectedAt(earthquake.detectedAt)} · {earthquake.depthKm.toFixed(1)} km de profundidad</small></span>
          <strong>{distanceKm == null ? 'Ver' : formatEarthquakeDistance(distanceKm)}</strong>
          <ChevronRight aria-hidden="true"/>
        </button>
        <a href={earthquake.url} target="_blank" rel="noreferrer" aria-label={`Abrir ficha oficial USGS de ${earthquake.place}`} title="Ficha oficial USGS"><ExternalLink aria-hidden="true"/></a>
      </article>)}
    </div>
    <p className="earthquake-summary-warning">Información sísmica independiente. No es una alerta de tsunami ni modifica el riesgo de incendio.</p>
  </section>;
}
