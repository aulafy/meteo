# AGENTS.md

## Propósito del repositorio

METEO es a la vez una demo geoespacial y un proyecto educativo. Los cambios deben
mejorar el producto sin ocultar cómo funciona. La aplicación nunca debe presentar
una detección térmica, una explicación de IA o una ruta importada como una orden
oficial de emergencia.

## Antes de editar

1. Lee `README.md` y `docs/tutorial/README.md`.
2. Localiza la etapa didáctica y el archivo real afectados.
3. Conserva la separación entre datos públicos, lógica determinista e IA.
4. No añadas servicios externos sin documentar licencia, coste, límites, datos
   enviados y comportamiento cuando fallen.

## Reglas de seguridad

- Nunca escribas claves reales en el repositorio, ejemplos, pruebas o capturas.
- Toda variable `VITE_*` es pública y puede verla cualquier visitante.
- `SUPABASE_SERVICE_ROLE_KEY`, claves de IA, VAPID privada y `CRON_SECRET` solo
  pueden existir en funciones servidor y gestores de secretos.
- Valida en el servidor cualquier cuerpo, parámetro o dato externo antes de usarlo.
- La IA explica una evaluación ya calculada; no decide el riesgo, no inventa datos
  y no recibe el GPS preciso de la persona.
- Una función costosa debe tener límite de entrada, salida, frecuencia y tiempo.
- No relajes RLS, CSP, retención o consentimiento para simplificar una demo.

## Convenciones didácticas

- Prefiere nombres explícitos y funciones pequeñas a abstracciones prematuras.
- Cuando una pieza sea difícil, añade una explicación en el capítulo correspondiente,
  no comentarios que repitan línea por línea el código.
- Cada capítulo debe incluir resultado, pasos, prueba, fallo esperado y advertencia
  de coste o seguridad cuando corresponda.
- Si cambia un endpoint, una variable o un flujo, actualiza a la vez README,
  `.env.example` y el capítulo relacionado.

## Verificación obligatoria

```bash
npm run check
```

Para cambios de interfaz, abre también la aplicación en móvil y escritorio. Para
cambios en fuentes externas, prueba explícitamente éxito, respuesta inválida,
timeout y ausencia temporal de datos.

