# Contribuir a METEO

Este repositorio acepta mejoras técnicas y educativas. Una contribución útil debe
permitir entender qué problema resuelve, qué riesgo introduce y cómo se comprobó.

## Flujo recomendado

```bash
git clone https://github.com/aulafy/meteo.git
cd meteo
npm ci
npm run check
git switch -c mejora/nombre-corto
```

Mantén los cambios pequeños. No mezcles en una misma propuesta un nuevo proveedor,
un rediseño completo y una migración de base de datos.

## Qué debe explicar una propuesta

- resultado visible;
- archivos y decisiones principales;
- pruebas ejecutadas;
- datos personales o de localización afectados;
- servicio externo nuevo o modificado;
- efecto estimado en llamadas, transferencia, almacenamiento y tokens;
- procedimiento de desactivación o vuelta atrás.

## Fuentes y contenido sensible

Los feeds de emergencias pueden retrasarse, cambiar o dejar de responder. Conserva
fuente, instante de actualización y límites en la interfaz. No uses ubicaciones,
suscripciones push o claves reales como datos de prueba.

Las vulnerabilidades deben comunicarse mediante un
[aviso privado de seguridad](https://github.com/aulafy/meteo/security/advisories/new),
no mediante una issue pública.

