import { z } from 'zod';

const fireSchema = z.object({
  id: z.string().min(1).max(200),
  coordinates: z.tuple([
    z.number().min(-19).max(5),
    z.number().min(27).max(44.5),
  ]),
  name: z.string().min(1).max(120),
  confidence: z.number().int().min(0).max(100),
  intensity: z.number().int().min(0).max(100),
  frp: z.number().nonnegative().optional(),
  detectedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Fecha inválida'),
  source: z.literal('NASA FIRMS'),
});

const fireFeedSchema = z.object({
  generatedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Fecha inválida'),
  fires: z.array(fireSchema).max(10_000),
});

export type NormalizedFire = z.infer<typeof fireSchema>;

export function parseFirmsFeed(input: unknown) {
  return fireFeedSchema.parse(input);
}

export function fireObservationRows(fires: NormalizedFire[], ingestedAt = new Date().toISOString()) {
  return fires.map((fire) => ({
    source: fire.source,
    source_id: fire.id,
    longitude: fire.coordinates[0],
    latitude: fire.coordinates[1],
    confidence: fire.confidence,
    intensity: fire.intensity,
    frp: fire.frp ?? null,
    detected_at: fire.detectedAt,
    ingested_at: ingestedAt,
    updated_at: ingestedAt,
  }));
}
