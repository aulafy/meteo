# 8. Convierte el proyecto técnico en una demo SaaS honesta

## Resultado

Diseñarás una demo que enseña valor sin fingir facturación, usuarios, garantías o
automatización inexistentes. Separarás funciones gratuitas, costosas y críticas.

## 1. Define una tarea central

Para METEO la tarea central no es «ver un mapa». Es:

```text
elegir ubicación → consultar datos con fuente → entender proximidad y antigüedad
→ abrir canales oficiales
```

La IA, el relieve 3D y las rutas importadas son complementos. Una demo SaaS debe
demostrar la tarea central antes de pedir registro o pago.

## 2. Clasifica funciones por coste y riesgo

| Función | Coste marginal | Riesgo | Estado recomendado |
|---|---:|---:|---|
| mapa y lista | transferencia de teselas | medio | siempre disponible |
| meteorología | llamadas API | medio | caché y fallback |
| IA | tokens + función | alto | bajo demanda y apagable |
| alertas 24/7 | DB + cron + push | alto | piloto con consentimiento |
| recomendación de ruta | datos y responsabilidad | crítico | fuera de la demo |

No uses la palabra «gratis» para una función cuyo proveedor solo permite uso no
comercial o tiene una cuota que no has calculado.

## 3. Diseña tres modos reales

- **Exploración local:** datos públicos y fixtures; sin secretos ni persistencia.
- **Demo pública:** proveedores configurados, límites estrictos, datos no sensibles.
- **Piloto controlado:** Supabase y alertas con participantes, consentimiento y
  soporte definidos.

Cada modo necesita una señal visible y un interruptor técnico. No dejes una función
medio configurada que falle después de solicitar datos personales.

## 4. Explica estados de producto

| Estado | Qué ve la persona |
|---|---|
| demo | datos reales cuando están disponibles, sin garantía de servicio |
| función desactivada | por qué no está disponible y qué recorrido sigue funcionando |
| límite alcanzado | cuándo reintentar, sin cobrar ni perder trabajo |
| proveedor caído | último dato con fecha o estado «no disponible» |
| piloto cerrado | quién participa y cómo se eliminan los datos |

## 5. Define métricas que no incentiven abuso

- tarea central completada;
- fuente oficial abierta;
- porcentaje de fallos por proveedor;
- latencia y llamadas por sesión;
- solicitudes IA por usuario y coste medio;
- altas y bajas de alertas;
- datos eliminados dentro del plazo.

Evita optimizar «tiempo en pantalla» en un contexto de emergencia.

## 6. Escribe el contrato de la demo

```md
## Esto demuestra
- [capacidad técnica concreta]

## Esto no demuestra
- [garantía, cobertura o función aún inexistente]

## Datos usados
- [fuente, frecuencia, licencia y atribución]

## Costes que crecerán
- [métrica y presupuesto]

## Cómo apagarla
- [interruptor, rollback o variable]
```

## Evidencia

Pide a una persona técnica que use la demo sin explicaciones. Debe identificar la
tarea central, distinguir datos oficiales de explicación IA y encontrar los límites
antes de activar ubicación persistente.

