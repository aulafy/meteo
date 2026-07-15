# 5. Añade un backend serverless solo donde hace falta

## Resultado

Crearás una función que protege una clave, valida entrada, limita abuso y devuelve
una respuesta pequeña con política de caché explícita.

## 1. Decide qué debe salir del navegador

Usa una función servidor cuando exista al menos uno de estos motivos:

- clave privada;
- proveedor sin CORS adecuado;
- normalización costosa compartida por usuarios;
- autorización o escritura en base de datos;
- límite de uso centralizado;
- filtrado de datos que no deben llegar completos al cliente.

No crees un proxy transparente que permita al visitante elegir cualquier URL.

## 2. Define un contrato mínimo

Las funciones de METEO usan tipos pequeños en `api/_lib.ts`. Un handler debe:

1. aceptar solo métodos conocidos;
2. validar cuerpo o parámetros;
3. limitar tamaño y cardinalidad;
4. comprobar autorización si aplica;
5. controlar timeout del proveedor;
6. normalizar la salida;
7. ocultar errores y secretos internos;
8. definir caché.

```ts
if (request.method !== 'POST') {
  return json(response, { error: 'Método no permitido' }, 405);
}
```

## 3. Guarda secretos correctamente

```text
correcto: GROQ_API_KEY en variables de Vercel para servidor
incorrecto: VITE_GROQ_API_KEY
incorrecto: clave escrita en vercel.json, README, test o URL
```

Una clave expuesta debe revocarse y rotarse. Borrarla del último commit no la elimina
del historial, logs, forks o bundles ya publicados.

## 4. Añade defensa por capas

El `Map` de `api/_lib.ts` limita por instancia caliente y sirve como protección
básica y ejemplo comprobable. No es global: otras instancias no comparten estado y
un reinicio lo vacía.

Para una campaña pública añade:

- WAF o rate limiting distribuido;
- presupuesto y alertas del proveedor;
- timeout y abort de `fetch`;
- límite de payload;
- caché para lecturas comunes;
- circuit breaker o desactivación de la función cara;
- registros sin secretos ni GPS innecesario.

## 5. Haz el cron seguro e idempotente

METEO espera:

```http
Authorization: Bearer $CRON_SECRET
```

La tarea debe poder ejecutarse dos veces sin duplicar observaciones o avisos. Usa
claves únicas, `upsert` y registros de entrega. Evita que dos ejecuciones solapadas
modifiquen el mismo estado sin coordinación.

Vercel recomienda un secreto aleatorio para cron, idempotencia y un lock cuando
pueda haber concurrencia. Consulta
[Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## 6. Calcula el multiplicador

Una acción de usuario puede provocar varias operaciones:

```text
1 clic IA
  = 1 invocación Vercel
  + 1 solicitud al proveedor IA
  + tokens de entrada
  + tokens de salida
  + logs y transferencia
```

Limitar solo uno de esos componentes no limita el coste total.

## Evidencia

- [ ] método incorrecto devuelve 405;
- [ ] entrada inválida devuelve 400 sin llamar al proveedor;
- [ ] exceso devuelve 429 y `Retry-After`;
- [ ] ausencia de clave devuelve 503;
- [ ] error externo devuelve un mensaje genérico;
- [ ] ninguna respuesta incluye credenciales o stack trace.

