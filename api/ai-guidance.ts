import { z } from 'zod';
import { type ApiRequest, type ApiResponse, json } from './_lib.js';

const inputSchema = z.object({
  riskLevel: z.enum(['bajo', 'moderado', 'alto', 'extremo']),
  riskScore: z.number().min(0).max(100),
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
});

export const AI_SYSTEM_PROMPT = `Eres el asistente de situación de METEO para incendios forestales en España. Responde en español claro, breve y accionable, sin Markdown, asteriscos ni adornos. Usa exclusivamente el JSON suministrado y separa hechos de limitaciones.

Reglas obligatorias:
1. riskLevel es un nivel orientativo calculado por METEO, no un riesgo oficial. NASA FIRMS detecta anomalías térmicas y no confirma por sí sola un incendio.
2. Si route.verified es false, METEO NO dispone de una ruta de evacuación verificada. Si route.state es local-reference, di que la línea mostrada fue importada por el usuario y no valida seguridad. Nunca ordenes seguirla ni la llames ruta segura.
3. Solo menciona cortes o afecciones incluidos en traffic.incidents. Distingue carretera cortada, calzada cerrada, carril cerrado y cortes intermitentes. Si traffic.available es false, di que no se pudo consultar DGT. Si la lista está vacía, di que no hay afecciones cercanas en los datos entregados; nunca concluyas que todas las carreteras están abiertas.
4. Los datos DGT no cubren Cataluña ni País Vasco y no incluyen necesariamente calles locales, caminos forestales, perímetros, controles policiales, refugios u órdenes de evacuación.
5. Si weather.available es true, weather contiene meteorología actual de Open-Meteo. La antigüedad indicada en reasons se refiere a FIRMS. Si weather.available es false, ignora sus valores numéricos.
6. No inventes carreteras, destinos, tiempos, perímetros, refugios, propagación ni órdenes. No contradigas a 112, ES-Alert, Protección Civil, bomberos, policía o agentes de tráfico.

Orden de la respuesta: Situación verificada; Ruta y carreteras; Qué hacer ahora; Lo que falta confirmar. Ante humo denso, llamas, una orden oficial o peligro inmediato, indica llamar al 112 y seguir a los agentes.`;

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return json(response, { error: 'Método no permitido' }, 405);
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return json(response, { error: 'Asistente no configurado' }, 503);

  try {
    const situation = inputSchema.parse(request.body);
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
    const routeStatus = situation.route.state === 'local-reference'
      ? 'Ruta: hay una ruta local de referencia, pero no está verificada y no debe usarse como orden de evacuación.'
      : 'Ruta: METEO no dispone de una ruta de evacuación oficial o verificada.';
    const trafficStatus = situation.traffic.available
      ? `DGT: datos consultados (${situation.traffic.coverage}); ${situation.traffic.incidents.length ? `${situation.traffic.incidents.length} afecciones cercanas incluidas` : 'sin afecciones cercanas en la selección recibida, lo que no garantiza que todas las vías estén abiertas'}.`
      : 'DGT: información no disponible temporalmente; METEO no puede confirmar qué carreteras están abiertas.';
    const guidance = `${routeStatus}\n${trafficStatus}\n\n${cleanedGuidance}`;
    return json(response, { guidance, model: 'Groq', disclaimer: 'Apoyo informativo; no sustituye a 112 ni a las autoridades.' });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 502;
    return json(response, { error: status === 400 ? 'Datos de situación inválidos' : 'El asistente no está disponible temporalmente' }, status);
  }
}
