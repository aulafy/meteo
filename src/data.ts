import type { Fire, SafePlace } from './types';

export const DEMO_CENTER: [number, number] = [-3.7038, 40.4168];

export const demoFires: Fire[] = [
  { id: 'f-1', coordinates: [-3.842, 40.514], name: 'Foco Sierra Oeste', confidence: 92, intensity: 78, detectedAt: new Date(Date.now() - 8 * 60000).toISOString(), source: 'Demo' },
  { id: 'f-2', coordinates: [-3.596, 40.493], name: 'Foco Valdebebas', confidence: 81, intensity: 55, detectedAt: new Date(Date.now() - 21 * 60000).toISOString(), source: 'Demo' },
  { id: 'f-3', coordinates: [-3.765, 40.348], name: 'Foco Arroyo Culebro', confidence: 74, intensity: 42, detectedAt: new Date(Date.now() - 36 * 60000).toISOString(), source: 'Demo' },
];

export const safePlaces: SafePlace[] = [
  { id: 's-1', name: 'Centro Deportivo Municipal', type: 'refugio', coordinates: [-3.675, 40.438], capacity: '420 plazas' },
  { id: 's-2', name: 'Hospital General', type: 'hospital', coordinates: [-3.695, 40.402], capacity: 'Atención 24 h' },
  { id: 's-3', name: 'Punto de encuentro Retiro', type: 'punto seguro', coordinates: [-3.684, 40.414], capacity: 'Zona abierta' },
  { id: 's-4', name: 'Pabellón Norte', type: 'refugio', coordinates: [-3.711, 40.458], capacity: '260 plazas' },
];
