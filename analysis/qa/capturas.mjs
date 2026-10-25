import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:3101';
const OUT = 'D:/Proyectos/Github/Tesis/analysis';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const navegador = await chromium.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 960 },
  locale: 'es-CU',
  timezoneId: 'America/Havana',
});
const pagina = await contexto.newPage();
const errores = [];
pagina.on('console', (mensaje) => {
  if (mensaje.type() === 'error') errores.push(`console: ${mensaje.text()}`);
});
pagina.on('pageerror', (error) => errores.push(`pageerror: ${error.message}`));

await pagina.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await pagina.screenshot({ path: `${OUT}/web-00-login.png` });

await pagina.getByLabel('Correo electrónico').fill('admin@upr.edu.cu');
await pagina.getByLabel('Contraseña', { exact: true }).fill('Admin1234!');
await pagina.getByRole('button', { name: 'Iniciar sesión' }).click();
await pagina.waitForSelector('.app-shell', { timeout: 20000 });
await pagina.waitForTimeout(1600);
await pagina.screenshot({ path: `${OUT}/web-01-panel.png` });

const rutas = [
  ['#/profesores', 'web-02-profesores', 1200],
  ['#/contratos', 'web-03-contratos', 1200],
  ['#/prenomina', 'web-04-prenomina', 2200],
  ['#/pagos', 'web-05-pagos', 1200],
  ['#/usuarios', 'web-06-usuarios', 1200],
  ['#/configuracion', 'web-07-configuracion', 1500],
  ['#/auditoria', 'web-08-auditoria', 1200],
  ['#/ayuda', 'web-09-ayuda', 1000],
];

for (const [hash, nombre, espera] of rutas) {
  await pagina.evaluate((destino) => {
    window.location.hash = destino;
  }, hash);
  await pagina.waitForTimeout(espera);
  await pagina.screenshot({ path: `${OUT}/${nombre}.png` });
  const titulo = await pagina.locator('.cabecera h1').textContent();
  console.log(`${hash} -> ${titulo?.trim()}`);
}

await pagina.evaluate(() => {
  window.location.hash = '#/contratos';
});
await pagina.waitForTimeout(900);
await pagina.getByRole('button', { name: 'Nuevo contrato' }).click();
await pagina.waitForTimeout(700);
await pagina.screenshot({ path: `${OUT}/web-10-formulario-contrato.png` });
await pagina.keyboard.press('Escape');

const salud = await pagina.evaluate(async () => {
  const respuesta = await fetch('/api/salud');
  return respuesta.json();
});
console.log('salud', JSON.stringify(salud));
console.log('errores', JSON.stringify(errores, null, 2));
await navegador.close();
