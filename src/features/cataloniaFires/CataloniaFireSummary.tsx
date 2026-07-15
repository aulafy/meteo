import { ChevronRight, ExternalLink, Siren } from 'lucide-react';
import type { Coordinates } from '../../types';
import { cataloniaFireKindLabel, cataloniaFirePhaseLabel, cataloniaFireResourcesLabel, selectCataloniaFiresForSummary } from './selectors';
import type { CataloniaFireIncident } from './types';
import type { PublicDataMode } from '../../public-data-resilience';

interface CataloniaFireSummaryProps {
  incidents: CataloniaFireIncident[];
  location: Coordinates | null;
  mode: PublicDataMode;
  statusText: string;
  now: number;
  onSelect: (incident: CataloniaFireIncident) => void;
  onShowLayer: () => void;
}

const formatDate = (value: string) => new Date(value).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function CataloniaFireSummary({ incidents, location, mode, statusText, now, onSelect, onShowLayer }: CataloniaFireSummaryProps) {
  const items = selectCataloniaFiresForSummary(location, incidents, now);
  return <section className="panel-section catalonia-fire-section">
    <div className="section-title"><div><h2>Actuaciones en Cataluña</h2><span>Bombers Generalitat · {statusText}</span></div><button type="button" onClick={onShowLayer}>Ver capa</button></div>
    {mode === 'loading' && incidents.length === 0 && <p className="route-copy">Cargando actuaciones oficiales de vegetación…</p>}
    {mode === 'error' && incidents.length === 0 && <p className="route-copy">Bombers no está disponible. Consulta el visor oficial y el 112.</p>}
    {mode === 'cache' && <p className="source-cache-warning">Copia local: puede haber actuaciones nuevas, cambios de fase o retiradas que aún no aparecen.</p>}
    {(mode === 'live' || mode === 'cache') && items.length === 0 && <p className="route-copy">Sin actuaciones operativas en la copia disponible.</p>}
    <div className="catalonia-fire-list">
      {items.map(({ incident, distanceKm }) => <article className="catalonia-fire-row" key={incident.id}>
        <button type="button" onClick={() => onSelect(incident)} aria-label={`Ver actuación de Bombers en ${incident.municipality}`}>
          <span className={`catalonia-fire-phase phase-${incident.phase}`}><Siren aria-hidden="true"/></span>
          <span><b>{incident.municipality}</b><small>{cataloniaFireKindLabel(incident.kind)} · {cataloniaFirePhaseLabel(incident.phase)} · {cataloniaFireResourcesLabel(incident.resources)}</small><small>Act. {formatDate(incident.updatedAt)}</small></span>
          {distanceKm != null && <strong>{distanceKm < 1_000 ? `${distanceKm.toFixed(1)} km` : `${Math.round(distanceKm)} km`}</strong>}
          <ChevronRight aria-hidden="true"/>
        </button>
        <a href={incident.officialUrl} target="_blank" rel="noreferrer" aria-label="Abrir visor oficial de Bombers" title="Visor oficial"><ExternalLink aria-hidden="true"/></a>
      </article>)}
    </div>
    <p className="catalonia-fire-warning">Actuaciones operativas publicadas por Bombers; no son perímetros ni órdenes de evacuación. “Fase no publicada” no significa incendio activo.</p>
  </section>;
}
