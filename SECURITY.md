# Seguridad

## Versiones mantenidas

METEO está en fase beta. Solo la versión desplegada desde `main` recibe correcciones de seguridad.

## Comunicar una vulnerabilidad

Utiliza un [aviso privado de seguridad de GitHub](https://github.com/aulafy/meteo/security/advisories/new). No publiques claves, ubicaciones, endpoints push, datos personales ni detalles que permitan explotar el servicio en una issue pública.

Incluye el componente afectado, el impacto, los pasos mínimos para reproducirlo y una forma segura de verificar la corrección. No pruebes una vulnerabilidad contra datos o dispositivos de terceras personas.

## Credenciales

Las claves de Groq, FIRMS, Supabase service role, CRON y VAPID privada deben existir únicamente en los gestores de secretos de Vercel o GitHub Actions. Las variables con prefijo `VITE_` se consideran públicas porque Vite las incorpora al navegador.

Si una credencial aparece en un commit, log, captura o conversación compartida, debe rotarse; eliminarla del último commit no basta.

## Alcance de seguridad operacional

Los fallos que puedan transformar una detección térmica en una falsa confirmación, inventar una ruta de evacuación o ocultar la antigüedad de un dato se tratan también como incidentes de seguridad. METEO no sustituye a 112, ES-Alert ni a las autoridades.
