# 9. Despliega en Vercel con preview y producción

## Resultado

Publicarás una preview, probarás funciones y cabeceras y decidirás si el plan
elegido soporta la frecuencia real del proyecto.

## 1. Separa entornos

| Entorno | Datos | Claves | Uso |
|---|---|---|---|
| local | fixtures o servicios de prueba | `.env.local`, nunca Git | desarrollo |
| preview | proyecto Supabase de prueba | variables Preview | revisión |
| producción | datos reales mínimos | variables Production | usuarios |

Nunca apuntes una preview creada por una rama a la base de producción por comodidad.

## 2. Importa el repositorio

En Vercel:

1. importa `aulafy/meteo` o tu fork;
2. detecta Vite;
3. usa `npm run build` y `dist`;
4. configura únicamente las variables necesarias para la etapa;
5. despliega primero una preview;
6. verifica y después promociona o integra la rama.

## 3. Comprueba las cabeceras

`vercel.json` define HSTS, `nosniff`, protección de frames, política de permisos y
una CSP inicialmente en modo Report-Only. El modo de informe permite observar
bloqueos antes de convertir la política en obligatoria, pero no protege frente a
todo lo que reporta.

Revisa consola y peticiones. Cuando todas las fuentes necesarias estén enumeradas,
planifica pasar a `Content-Security-Policy` y conserva una forma de rollback.

## 4. No confundas hosting estático con funciones

El frontend puede tener un coste muy bajo y, al mismo tiempo, cada clic de IA,
consulta proxy o evaluación de alertas ejecuta una función. Mide por separado:

- invocaciones;
- CPU activa y memoria;
- transferencia;
- logs;
- solicitudes y tokens de proveedores externos.

La documentación vigente está en
[Vercel Functions: uso y precios](https://vercel.com/docs/functions/usage-and-pricing)
y [límites](https://vercel.com/docs/limits).

## 5. Comprueba la frecuencia del cron

En la documentación revisada el 15 de julio de 2026, Vercel Hobby permite cron como
mínimo una vez al día y con precisión horaria. METEO necesita evaluar alertas cada
15 minutos, así que esa operación requiere Pro o un programador externo compatible.

No despliegues una alerta 24/7 suponiendo que el cron de Hobby funcionará. Verifica
siempre [uso y precios de Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Si usas un programador externo, debe enviar `Authorization: Bearer $CRON_SECRET`,
registrar fallos y respetar idempotencia.

## 6. Lista de comprobación de preview

- [ ] `npm run check` y `npm run test:e2e` pasan desde un clon limpio;
- [ ] variables Preview no apuntan a producción;
- [ ] mapa, búsqueda y estados de error funcionan;
- [ ] ninguna clave aparece en Sources o Network del navegador;
- [ ] CSP no reporta dominios inesperados;
- [ ] IA respeta límites y modo apagado;
- [ ] alta y baja de alertas usan datos de prueba;
- [ ] cron rechaza una petición sin secreto;
- [ ] existe rollback a un deployment conocido.

## 7. Publica con presupuesto

Antes de producción fija alertas de uso, Spend Cap cuando aplique, límite de IA,
responsable y condición de apagado. «Miraremos la factura» no es control preventivo.
