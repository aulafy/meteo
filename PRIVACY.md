# Transparencia y privacidad

METEO está en fase beta. Este documento describe el tratamiento técnico actual y no debe interpretarse como una certificación jurídica. Antes de una campaña pública debe publicarse un canal verificable de contacto del responsable del tratamiento.

## Consulta sin activar avisos

METEO puede usar una ubicación elegida o el GPS autorizado para consultar meteorología, calidad del aire, elevación y proximidad. La aplicación no crea una cuenta personal ni solicita nombre, correo o teléfono. Los proveedores de datos reciben las solicitudes necesarias y la dirección IP de conexión conforme a sus propias políticas.

La explicación de Groq recibe la etiqueta de ubicación, distancias ya calculadas, meteorología, detecciones FIRMS e incidencias DGT. No recibe las coordenadas GPS del residente.

## Avisos remotos 24/7

Solo después de marcar el consentimiento y aceptar los permisos del navegador se envían al backend:

- latitud y longitud GPS;
- radio de aviso;
- endpoint y material criptográfico de la suscripción Web Push;
- versión y fecha del consentimiento;
- fechas de alta y última actualización.

Estos datos se utilizan exclusivamente para buscar detecciones FIRMS próximas y entregar avisos al dispositivo. No se venden ni se utilizan para publicidad.

Las tablas tienen RLS activado y la aplicación accede mediante funciones servidor con `service_role`; esa clave nunca se entrega al navegador. La ubicación permanece mientras la suscripción esté activa y se elimina automáticamente tras 180 días sin renovación. Las entregas se conservan hasta 365 días para evitar duplicados y poder auditar el canal.

## Eliminación

El botón «Desactivar y eliminar mi ubicación» borra la suscripción del servidor y cancela el canal Web Push del navegador. Para comunicar de forma privada un problema de eliminación o una exposición de datos, utiliza un [aviso privado de GitHub](https://github.com/aulafy/meteo/security/advisories/new) y no incluyas la ubicación en una issue pública.

## Proveedores y fuentes

El servicio utiliza Vercel para la aplicación y sus funciones, Supabase para almacenamiento, proveedores Web Push para la entrega, Groq para explicaciones, Open-Meteo para datos meteorológicos y servicios públicos como FIRMS, DGT, Bombers, EFFIS y USGS para el contexto operativo.

Los archivos GPX, KML y GeoJSON se procesan localmente. Solo si la persona solicita el perfil de elevación se envía una muestra de coordenadas a Open-Meteo.

## Datos locales

El navegador conserva indicadores de activación de avisos y el endpoint push para poder solicitar su eliminación. METEO no incorpora actualmente analítica publicitaria ni seguimiento comercial.
