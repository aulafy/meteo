# 7. Integra IA sin convertirla en árbitro

## Resultado

Construirás `/api/ai-guidance`: una explicación opcional sobre JSON validado, con
clave en servidor, contexto mínimo, salida corta y respuesta determinista de apoyo.

## 1. Elige una tarea estrecha

Tarea adecuada:

> Explicar en español una evaluación que la aplicación ya ha calculado y recordar
> qué falta confirmar.

Tareas rechazadas:

- decidir si existe un incendio;
- calcular la puntuación o la distancia;
- inventar una ruta de evacuación;
- afirmar que una carretera está abierta;
- sustituir una orden oficial.

## 2. Valida antes de gastar tokens

`api/ai-guidance.ts` usa Zod para limitar:

- nivel y puntuación;
- rangos meteorológicos;
- número y tamaño de razones;
- entre una y cinco detecciones;
- coordenadas dentro del ámbito;
- hasta cinco incidencias de tráfico;
- estado de una ruta siempre no verificada.

La entrada inválida devuelve 400 sin llamar al modelo. Esto es seguridad y control
de costes.

## 3. Minimiza datos

El servidor recibe una etiqueta de ubicación, datos ya calculados y coordenadas de
fuentes públicas. No recibe el GPS preciso ni las coordenadas de búsqueda de la
persona. Pregunta para cada campo: «¿cambiaría la explicación si lo elimino?».

## 4. Escribe reglas comprobables

Un buen prompt de sistema enumera prohibiciones y el orden de respuesta. Aun así,
el prompt no es una frontera de seguridad. El código:

- selecciona previamente las observaciones;
- genera enlaces verificables fuera del modelo;
- añade estado de ruta y DGT de forma determinista;
- limita tokens y temperatura;
- limpia una salida antes de mostrarla;
- conserva un aviso visible.

## 5. Protege la ruta

```text
navegador → payload limitado → Zod → rate limit → proveedor IA
                                     ↓
                            error genérico / 429
```

La clave `GROQ_API_KEY` solo vive en el servidor. El endpoint aplica actualmente un
límite básico de 12 solicitudes por minuto e instancia; para público real necesita
un límite distribuido o WAF.

## 6. Diseña el modo apagado

Si falta la clave o se supera el presupuesto, la aplicación debe conservar mapa,
fuentes y guía determinista. La IA es una mejora, no una dependencia del recorrido
esencial.

## 7. Estima tokens

```text
coste IA mensual = solicitudes ×
  ((tokens entrada / 1.000.000 × precio entrada)
 + (tokens salida / 1.000.000 × precio salida))
```

El modelo por defecto actual limita la salida a 420 tokens. Revisa el precio vigente
en [Groq Pricing](https://groq.com/pricing) antes de activar una campaña. Un plan
gratuito, crédito inicial o precio actual puede cambiar sin que cambie este repo.

## 8. Prueba comportamiento, no prosa exacta

Evalúa un conjunto fijo de situaciones:

- sin ubicación;
- meteorología ausente;
- DGT caída;
- ruta local importada;
- detección antigua;
- riesgo bajo y extremo;
- texto malicioso dentro de una etiqueta externa.

Comprueba ausencia de afirmaciones prohibidas, presencia de fuentes y límites, y
longitud máxima. No exijas la misma frase literal a un modelo generativo.

```bash
npm test -- api/ai-guidance.test.ts
```

## Variante con OpenAI

El mismo patrón puede implementarse con la Responses API: entrada estructurada,
salida limitada, clave solo en servidor y validación de la respuesta. No mezcles dos
proveedores en el primer ejercicio; crea un adapter y conserva el contrato interno.
Consulta la [documentación oficial de migración a Responses](https://developers.openai.com/api/docs/guides/migrate-to-responses)
y los [precios vigentes](https://openai.com/api/pricing/) antes de elegir modelo.

## Evidencia

- [ ] el bundle no contiene la clave;
- [ ] un payload grande falla antes del proveedor;
- [ ] el modelo no recibe GPS preciso;
- [ ] la salida nunca se usa para calcular riesgo;
- [ ] el recorrido funciona con la IA apagada;
- [ ] existe un presupuesto mensual y un procedimiento de corte.
