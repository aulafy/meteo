import { describe, expect, it } from 'vitest';
import { distanceMeters, formatDistance, measurePath } from './measurements';

describe('map measurements', () => {
  it('measures a geodesic segment', () => {
    expect(distanceMeters([0, 0], [1, 0])).toBeGreaterThan(111_000);
    expect(distanceMeters([0, 0], [1, 0])).toBeLessThan(111_300);
  });

  it('adds segments and incorporates terrain elevation', () => {
    const result = measurePath([[0, 0], [0.001, 0], [0.002, 0]], [0, 100, 50]);
    expect(result.planarMeters).toBeGreaterThan(220);
    expect(result.surfaceMeters).toBeGreaterThan(result.planarMeters);
    expect(result.ascentMeters).toBe(100);
    expect(result.descentMeters).toBe(50);
  });

  it('does not claim a terrain result when a sample is unavailable', () => {
    const result = measurePath([[0, 0], [0.001, 0]], [null, 20]);
    expect(result.surfaceMeters).toBeNull();
    expect(result.ascentMeters).toBeNull();
  });

  it('formats metres and kilometres legibly', () => {
    expect(formatDistance(250)).toBe('250 m');
    expect(formatDistance(1_250)).toBe('1.25 km');
  });
});
