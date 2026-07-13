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
});

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
            content: 'Eres el asistente de seguridad de METEO para incendios forestales en España. Responde en español claro, breve y accionable, sin Markdown, asteriscos ni encabezados decorativos. Usa exclusivamente los datos suministrados. Describe riskLevel solo como nivel orientativo de METEO: no afirmes que existe un incendio, un riesgo oficial o una orden. Si weather.available es true, los valores weather son meteorología actual de Open-Meteo y no debes declararlos desconocidos; la antigüedad de la observación en reasons se refiere únicamente a NASA FIRMS. Si weather.available es false, trata todos sus valores numéricos como ausentes y dilo claramente. Una detección NASA FIRMS es una anomalía térmica, no un incendio confirmado. No inventes carreteras, perímetros, refugios, tiempos de llegada ni órdenes de evacuación. No contradigas a 112, ES-Alert, Protección Civil, bomberos o policía. Estructura la respuesta con: Situación, Qué hacer ahora, Qué no sabemos. Si el nivel es alto o extremo, indica llamar al 112 ante peligro inmediato y seguir canales oficiales.',
          },
          { role: 'user', content: JSON.stringify(situation) },
        ],
      }),
    });
    if (!groqResponse.ok) throw new Error(`Groq ${groqResponse.status}`);
    const result = await groqResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
    const rawGuidance = result.choices?.[0]?.message?.content?.trim();
    if (!rawGuidance) throw new Error('Respuesta vacía');
    const guidance = rawGuidance.replace(/\*\*/g, '').replace(/^\s*\*\s+/gm, '• ');
    return json(response, { guidance, model: 'Groq', disclaimer: 'Apoyo informativo; no sustituye a 112 ni a las autoridades.' });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 502;
    return json(response, { error: status === 400 ? 'Datos de situación inválidos' : 'El asistente no está disponible temporalmente' }, status);
  }
}
