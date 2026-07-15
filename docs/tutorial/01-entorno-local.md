# 1. Prepara un entorno local reproducible

## Resultado

Arrancarás METEO, ejecutarás 45 pruebas y producirás un build sin configurar
Supabase ni una API de IA.

## 1. Clona y crea una rama

```bash
git clone https://github.com/aulafy/meteo.git
cd meteo
git switch -c aprendizaje/primer-recorrido
npm ci
```

Usamos `npm ci` porque respeta exactamente `package-lock.json`. Si falla, conserva
el error completo y comprueba primero la versión de Node; no borres el lockfile para
forzar una instalación distinta.

## 2. Verifica antes de cambiar

```bash
npm run check
```

El comando debe ejecutar pruebas, verificación del tutorial y build. El build puede
avisar de un bundle grande: es deuda de rendimiento, no permiso para ignorar una
compilación fallida.

## 3. Arranca la interfaz

```bash
npm run dev
```

Abre `http://localhost:5173`. Comprueba dos recorridos:

1. deniega la geolocalización: debe mantenerse una vista general sin distancias
   presentadas como personales;
2. busca manualmente una localidad: deben aparecer meteorología y contexto sin
   activar avisos remotos.

## 4. Entiende las variables

Copia el ejemplo solo cuando llegues a una función que lo requiera:

```bash
cp .env.example .env.local
```

Vite no carga automáticamente todas las variables de servidor de la misma forma que
Vercel. El frontend actual puede estudiarse sin ellas; las funciones `api/` se
prueban con Vitest o en un entorno compatible con Vercel.

Clasifica las variables antes de rellenarlas:

| Categoría | Ejemplo | ¿Puede estar en el navegador? |
|---|---|---|
| URL pública | `VITE_FIRES_URL` | sí |
| clave de proveedor | `GROQ_API_KEY` | no |
| privilegio administrativo | `SUPABASE_SERVICE_ROLE_KEY` | nunca |
| autenticación de tarea | `CRON_SECRET` | no |
| clave pública Web Push | `VAPID_PUBLIC_KEY` | sí, servida por endpoint |
| clave privada Web Push | `VAPID_PRIVATE_KEY` | no |

## 5. Recorre el proyecto por flujo

No empieces leyendo `App.tsx` línea a línea. Sigue una pregunta:

```text
¿Cómo llega el tiempo a la pantalla?
src/App.tsx → getWeather() → src/services.ts → Open-Meteo → validación → estado
```

Después sigue terremotos, incendios e IA. En cada recorrido anota entrada, salida,
fallo y lugar donde se conserva el secreto.

## Fallos útiles

- Puerto ocupado: identifica el proceso; no abras servidores sucesivos al azar.
- Pantalla sin mapa: revisa consola, CSP y URL del estilo antes de cambiar React.
- Meteorología no disponible: confirma la respuesta externa; no sustituyas con datos
  ficticios que parezcan reales.
- `npm install` cambia muchas versiones: restaura el alcance y usa `npm ci`.

## Evidencia

Guarda la salida de `npm run check` y una captura de la app con geolocalización
denegada. Debe ser posible repetir el resultado desde un clon limpio.

