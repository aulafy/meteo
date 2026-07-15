import { z } from 'zod';
import { type ApiRequest, type ApiResponse, enforceRateLimit, json } from './_lib.js';

export const aiInputSchema = z.object({
  locationProvided: z.boolean(),
  locationLabel: z.string().max(160).nullable(),
  riskLevel: z.enum(['bajo', 'moderado', 'alto', 'extremo']).nullable(),
  riskScore: z.number().min(0).max(100).nullable(),
  distanceKm: z.number().nonnegative().nullable(),
  confidence: z.number().min(0).max(100).nullable(),
  frp: z.number().nonnegative().nullable(),
  weather: z.object({
    available: z.boolean(),
    temperature: z.number(),
    humidity: z.number().min(0).max(100),
    windSpeed: z.number().nonnegative(),
    windDirection: z.number().min(0).max(360),
  }),
  reasons: z.array(z.string().max(180)).max(8),
  fires: z.array(z.object({
    name: z.string().min(1).max(120),
    coordinates: z.tuple([z.number().min(-19).max(5), z.number().min(27).max(44.5)]),
    detectedAt: z.string().max(60).refine((value) => Number.isFinite(Date.parse(value)), 'Fecha FIRMS inválida'),
    confidence: z.number().min(0).max(100),
    frp: z.number().nonnegative().nullable(),
    distanceKm: z.number().nonnegative().nullable(),
  })).min(1).max(5),
  route: z.object({
    state: z.enum(['none', 'local-reference']),
    verified: z.literal(false),
  }),
  traffic: z.object({
    available: z.boolean(),
    publishedAt: z.string().max(60).nullable(),
    coverage: z.string().max(180),
    incidents: z.array(z.object({
      road: z.string().max(40),
      status: z.string().max(80),
      cause: z.string().max(80),
      municipality: z.string().max(100),
      distanceKm: z.number().nonnegative(),
      updatedAt: z.string().max(60),
    })).max(5),
  }),
}).superRefine((value, context) => {
  if (value.locationProvided) {
    if (value.fires.length > 3) context.addIssue({ code: 'custom', path: ['fires'], message: 'Solo se admiten los tres focos más cercanos' });
    if (value.riskLevel === null) context.addIssue({ code: 'custom', path: ['riskLevel'], message: 'Falta el nivel orientativo para la ubicación' });
    if (value.riskScore === null) context.addIssue({ code: 'custom', path: ['riskScore'], message: 'Falta el índice orientativo para la ubicación' });
    return;
  }
  if (value.locationLabel !== null) context.addIssue({ code: 'custom', path: ['locationLabel'], message: 'No debe existir una etiqueta sin ubicación' });
  if (value.riskLevel !== null || value.riskScore !== null) context.addIssue({ code: 'custom', path: ['riskLevel'], message: 'No debe calcularse riesgo sin ubicación' });
  if (value.distanceKm !== null || value.confidence !== null || value.frp !== null) context.addIssue({ code: 'custom', path: ['distanceKm'], message: 'No debe calcularse proximidad sin ubicación' });
  if (value.fires.some((fire) => fire.distanceKm !== null)) context.addIssue({ code: 'custom', path: ['fires'], message: 'No debe calcularse distancia sin ubicación' });
  if (value.reasons.length > 0 || value.traffic.incidents.length > 0) context.addIssue({ code: 'custom', path: ['reasons'], message: 'No debe atribuirse contexto local sin ubicación' });
});

type AiSituation = z.infer<typeof aiInputSchema>;

export function googleMapsLink(coordinates: [number, number]) {
  const [longitude, latitude] = coordinates;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export function buildFireOverview(situation: Pick<AiSituation, 'locationProvided' | 'locationLabel' | 'fires'>) {
  const detectionLabel = situation.fires.length === 1 ? 'detección térmica' : 'detecciones térmicas';
  const heading = situation.locationProvided
    ? `${situation.fires.length} ${detectionLabel} más ${situation.fires.length === 1 ? 'cercana' : 'cercanas'}${situation.locationLabel ? ` a ${situation.locationLabel}` : ''}:`
    : `${situation.fires.length} ${detectionLabel} más ${situation.fires.length === 1 ? 'reciente' : 'recientes'} en España:`;
  const dateFormatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' });
  const rows = situation.fires.map((fire, index) => {
    const [longitude, latitude] = fire.coordinates;
    const distance = fire.distanceKm == null ? '' : ` · ${fire.distanceKm.toFixed(1)} km`;
    const power = fire.frp == null ? '' : ` · ${fire.frp.toFixed(1)} MW`;
    return `${index + 1}. ${fire.name}${distance}${power} · detectada ${dateFormatter.format(new Date(fire.detectedAt))} · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}\n${googleMapsLink(fire.coordinates)}`;
  });
  return `${heading}\n${rows.join('\n')}`;
}

export function buildNoLocationGuidance(situation: Pick<AiSituation, 'locationProvided' | 'locationLabel' | 'fires'>) {
  const fireOverview = buildFireOverview(situation);
  return `${fireOverview}

Ruta: METEO no dispone de una ruta de evacuación oficial o verificada.
DGT: sin ubicación no se ha calculado proximidad a incidencias de tráfico.

Situación verificada: este es un listado nacional de detecciones térmicas recientes de NASA FIRMS. No se ha calculado un nivel de riesgo para ninguna persona o municipio.

Ruta y carreteras: sin una ubicación y sin órdenes oficiales, METEO no puede determinar una ruta, un destino seguro ni qué carreteras sirven para evacuar.

Qué hacer ahora: elige un municipio o activa el GPS para calcular proximidad. Ante humo denso, llamas, una orden oficial o peligro inmediato, llama al 112 y sigue a los agentes.

Lo que falta confirmar: NASA FIRMS detecta anomalías térmicas y no confirma por sí sola incendios, perímetros, propagación ni órdenes de evacuación.`;
}

export const AI_SYSTEM_PROMPT = `Eres el asistente de situación de METEO para incendios forestales en España. Responde en español claro, breve y accionable, sin Markdown, asteriscos ni adornos. Usa exclusivamente el JSON suministrado y separa hechos de limitaciones.

Reglas obligatorias:
1. Con ubicación, riskLevel es un nivel orientativo calculado por METEO, no un riesgo oficial. Sin ubicación, riskLevel y riskScore son null y está prohibido anunciar o inferir cualquier nivel, índice o puntuación de riesgo. NASA FIRMS detecta anomalías térmicas y no confirma por sí sola un incendio.
2. Si route.verified es false, METEO NO dispone de una ruta de evacuación verificada. Si route.state es local-reference, di que la línea mostrada fue importada por el usuario y no valida seguridad. Nunca ordenes seguirla ni la llames ruta segura.
3. Solo menciona cortes o afecciones incluidos en traffic.incidents. Distingue carretera cortada, calzada cerrada, carril cerrado y cortes intermitentes. Si traffic.available es false, di que no se pudo consultar DGT. Si locationProvided es true y la lista está vacía, di que no hay afecciones cercanas en los datos entregados; nunca concluyas que todas las carreteras están abiertas. Sin ubicación, no hagas afirmaciones de proximidad.
4. Los datos DGT no cubren Cataluña ni País Vasco y no incluyen necesariamente calles locales, caminos forestales, perímetros, controles policiales, refugios u órdenes de evacuación.
5. Si weather.available es true, weather contiene meteorología actual de Open-Meteo. La antigüedad indicada en reasons se refiere a FIRMS. Si weather.available es false, ignora sus valores numéricos.
6. No inventes carreteras, destinos, tiempos, perímetros, refugios, propagación ni órdenes. No contradigas a 112, ES-Alert, Protección Civil, bomberos, policía o agentes de tráfico.
7. fires contiene la selección exacta de NASA FIRMS que METEO mostrará antes de tu explicación: hasta 3 detecciones más cercanas si locationProvided es true, o hasta 5 detecciones más recientes si es false. No las llames incendios confirmados, no cambies sus datos y no añadas otras. El servidor ya mostrará sus coordenadas y enlaces de Google Maps; no repitas el listado.
8. Si locationProvided es false, no atribuyas al usuario distancias, riesgo, meteorología ni tráfico de una ubicación concreta. Limítate a explicar que el listado es nacional y que debe elegir ubicación o activar GPS para calcular proximidad.

Orden de la explicación posterior al listado: Situación verificada; Ruta y carreteras; Qué hacer ahora; Lo que falta confirmar. Ante humo denso, llamas, una orden oficial o peligro inmediato, indica llamar al 112 y seguir a los agentes.`;

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return json(response, { error: 'Método no permitido' }, 405);
  if (!enforceRateLimit(request, response, { namespace: 'ai-guidance', limit: 12, windowMs: 60_000 })) return;

  try {
    const situation = aiInputSchema.parse(request.body);
    if (!situation.locationProvided) return json(response, {
      guidance: buildNoLocationGuidance(situation),
      model: 'METEO',
      disclaimer: 'Apoyo informativo; no sustituye a 112 ni a las autoridades.',
    });
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return json(response, { error: 'Asistente no configurado' }, 503);
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.2,
        max_completion_tokens: 420,
        messages: [
          {
            role: 'system',
            content: AI_SYSTEM_PROMPT,
          },
          { role: 'user', content: JSON.stringify(situation) },
        ],
      }),
    });
    if (!groqResponse.ok) throw new Error(`Groq ${groqResponse.status}`);
    const result = await groqResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
    const rawGuidance = result.choices?.[0]?.message?.content?.trim();
    if (!rawGuidance) throw new Error('Respuesta vacía');
    const cleanedGuidance = rawGuidance
      .replace(/\*\*/g, '')
      .replace(/^\s*\*\s+/gm, '• ')
      .replace(/nivel de riesgo de incendio forestal/gi, 'nivel orientativo de METEO')
      .replace(/riesgo de incendio forestal/gi, 'nivel orientativo de METEO');
    const fireOverview = buildFireOverview(situation);
    const routeStatus = situation.route.state === 'local-reference'
      ? 'Ruta: hay una ruta local de referencia, pero no está verificada y no debe usarse como orden de evacuación.'
      : 'Ruta: METEO no dispone de una ruta de evacuación oficial o verificada.';
    const trafficStatus = !situation.locationProvided
      ? 'DGT: sin ubicación no se ha calculado proximidad a incidencias de tráfico.'
      : situation.traffic.available
      ? `DGT: datos consultados (${situation.traffic.coverage}); ${situation.traffic.incidents.length ? `${situation.traffic.incidents.length} ${situation.traffic.incidents.length === 1 ? 'afección cercana incluida' : 'afecciones cercanas incluidas'}` : 'sin afecciones cercanas en la selección recibida, lo que no garantiza que todas las vías estén abiertas'}.`
      : 'DGT: información no disponible temporalmente; METEO no puede confirmar qué carreteras están abiertas.';
    const guidance = `${fireOverview}\n\n${routeStatus}\n${trafficStatus}\n\n${cleanedGuidance}`;
    return json(response, { guidance, model: 'Groq', disclaimer: 'Apoyo informativo; no sustituye a 112 ni a las autoridades.' });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 502;
    return json(response, { error: status === 400 ? 'Datos de situación inválidos' : 'El asistente no está disponible temporalmente' }, status);
  }
}
