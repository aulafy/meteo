import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tutorialDir = path.join(root, 'docs', 'tutorial');
const chapters = [
  'README.md',
  '00-producto-y-arquitectura.md',
  '01-entorno-local.md',
  '02-primer-mapa.md',
  '03-apis-publicas.md',
  '04-analisis-geoespacial.md',
  '05-backend-serverless.md',
  '06-supabase-postgis.md',
  '07-ia-acotada.md',
  '08-demo-saas.md',
  '09-despliegue-vercel.md',
  '10-costes-seguridad-escala.md',
  '11-proyectos-finales.md',
];

for (const chapter of chapters) {
  const file = path.join(tutorialDir, chapter);
  assert(fs.existsSync(file), `Falta el capítulo ${chapter}`);
  const content = fs.readFileSync(file, 'utf8');
  assert(content.length > 600, `${chapter} necesita contenido didáctico suficiente`);
  assert(!/\b(?:sk-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9_-]{16,})\b/.test(content), `${chapter} parece contener una clave`);
  verifyLocalLinks(file, content);
}

const index = fs.readFileSync(path.join(tutorialDir, 'README.md'), 'utf8');
for (const chapter of chapters.slice(1)) {
  assert(index.includes(`(${chapter})`), `El índice no enlaza ${chapter}`);
}

const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
assert(/las variables VITE_\* son públicas/i.test(envExample), '.env.example debe advertir que VITE_* es público');
for (const variable of ['SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'GROQ_API_KEY']) {
  assert(envExample.includes(variable), `.env.example no documenta ${variable}`);
}

const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
assert(readme.includes('docs/tutorial/README.md'), 'README debe enlazar el tutorial');
assert(
  readme.includes('Open-Meteo') && /uso no comercial|plan compatible/.test(readme),
  'README debe advertir el coste comercial de Open-Meteo',
);
assert(readme.includes('Cron Jobs') && readme.includes('Hobby'), 'README debe advertir el límite de cron Hobby');

console.log(`Verified educational route: ${chapters.length - 1} chapters, local links, cost and security warnings.`);

function verifyLocalLinks(file, content) {
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const href = match[1].split('#')[0];
    if (!href || /^(?:https?:|mailto:)/.test(href)) continue;
    const target = path.resolve(path.dirname(file), decodeURIComponent(href));
    assert(fs.existsSync(target), `${path.relative(root, file)} enlaza un archivo inexistente: ${href}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
