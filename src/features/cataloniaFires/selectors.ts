import distance from '@turf/distance';
import { point } from '@turf/helpers';
import type { Coordinates } from '../../types';
import type { CataloniaFireIncident, CataloniaFirePhase } from './types';

export interface RankedCataloniaFire {
  incident: CataloniaFireIncident;
  distanceKm: number | null;
}

const PHASE_LABELS: Record<CataloniaFirePhase, string> = {
  active: 'Activo',
  stabilized: 'Estabilizado',
  controlled: 'Controlado',
  extinguished: 'Extinguido',
  unknown: 'Fase no publicada',
};

export const cataloniaFirePhaseLabel = (phase: CataloniaFirePhase) => PHASE_LABELS[phase];

export function cataloniaFireKindLabel(kind: string) {
  const normalized = kind.trim().toLocaleLowerCase('ca');
  if (normalized.includes('forestal')) return 'Incendio de vegetación forestal';
  if (normalized.includes('agrícola') || normalized.includes('agricola')) return 'Incendio de vegetación agrícola';
  if (normalized.includes('urbana')) return 'Incendio de vegetación urbana';
  return kind;
}

export const cataloniaFireResourcesLabel = (resources: number) => `${resources} ${resources === 1 ? 'dotación' : 'dotaciones'}`;

export function isOperationalCataloniaFire(incident: CataloniaFireIncident, now = Date.now()) {
  if (incident.phase === 'extinguished') return false;
  if (incident.phase !== 'unknown') return true;
  const updatedAt = Date.parse(incident.updatedAt);
  return Number.isFinite(updatedAt) && updatedAt <= now + 5 * 60_000 && now - updatedAt <= 24 * 60 * 60_000;
}

export function selectOperationalCataloniaFires(incidents: CataloniaFireIncident[], now = Date.now()) {
  return incidents.filter((incident) => isOperationalCataloniaFire(incident, now));
}

export function selectCataloniaFiresForSummary(location: Coordinates | null, incidents: CataloniaFireIncident[], now = Date.now()): RankedCataloniaFire[] {
  const operational = selectOperationalCataloniaFires(incidents, now);
  if (location) return operational
    .map((incident) => ({ incident, distanceKm: distance(point(location), point(incident.coordinates), { units: 'kilometers' }) }))
    .sort((left, right) => (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity))
    .slice(0, 3);
  return [...operational]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 5)
    .map((incident) => ({ incident, distanceKm: null }));
}
