import { chromium } from 'playwright-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const navegador = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 960 } });
const eventos = [];
pagina.on('console', (m) => eventos.push(`console.${m.type()}: ${m.text()}`));
pagina.on('pageerror', (e) => eventos.push(`pageerror: ${e.message}`));
pagina.on('requestfailed', (r) => eventos.push(`failed: ${r.url()} ${r.failure()?.errorText}`));
pagina.on('response', (r) => {
  if (r.url().includes('.css') || r.url().includes('.js')) eventos.push(`${r.status()} ${r.url()}`);
});
await pagina.goto('http://127.0.0.1:3101/', { waitUntil: 'networkidle' });
await pagina.waitForTimeout(800);
const info = await pagina.evaluate(() => {
  const hojas = [...document.styleSheets].map((hoja) => {
    try {
      return { href: hoja.href, reglas: hoja.cssRules.length };
    } catch (error) {
      return { href: hoja.href, error: String(error) };
    }
  });
  const login = document.querySelector('.login');
  const h1 = document.querySelector('h1');
  return {
    hojas,
    loginExiste: Boolean(login),
    loginDisplay: login ? getComputedStyle(login).display : null,
    bodyFondo: getComputedStyle(document.body).backgroundColor,
    bodyFuente: getComputedStyle(document.body).fontFamily,
    h1Color: h1 ? getComputedStyle(h1).color : null,
    enlaces: [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href),
    html: document.documentElement.outerHTML.slice(0, 500),
  };
});
console.log(JSON.stringify({ info, eventos }, null, 2));
await navegador.close();
