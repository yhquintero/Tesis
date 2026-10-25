import {
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { config, secreto } from './config.js';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };

/* ------------------------------------------------------------------ */
/* Contraseñas                                                         */
/* ------------------------------------------------------------------ */

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize('NFKC'), salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verificarPassword(password, almacenado) {
  try {
    const [algoritmo, n, r, p, saltB64, hashB64] = String(almacenado).split('$');
    if (algoritmo !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const esperado = Buffer.from(hashB64, 'base64');
    const calculado = scryptSync(password.normalize('NFKC'), salt, esperado.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });
    return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
  } catch {
    return false;
  }
}

export function validarPoliticaPassword(password) {
  const errores = [];
  if (typeof password !== 'string' || password.length < 8) {
    errores.push('Debe tener al menos 8 caracteres.');
  }
  if (typeof password === 'string' && password.length > 128) {
    errores.push('No puede superar 128 caracteres.');
  }
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password || '')) errores.push('Debe incluir al menos una letra.');
  if (!/\d/.test(password || '')) errores.push('Debe incluir al menos un número.');
  if (!/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/.test(password || '')) {
    errores.push('Debe incluir al menos un símbolo.');
  }
  return errores;
}

/** Contraseña temporal legible, cumple la política. */
export function passwordTemporal() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const numeros = '23456789';
  const simbolos = '!@#$%*?';
  const partes = [
    letras[randomBytes(1)[0] % letras.length],
    numeros[randomBytes(1)[0] % numeros.length],
    simbolos[randomBytes(1)[0] % simbolos.length],
  ];
  const alfabeto = letras + numeros + simbolos;
  while (partes.length < 12) partes.push(alfabeto[randomBytes(1)[0] % alfabeto.length]);
  return partes.sort(() => (randomBytes(1)[0] % 2 === 0 ? 1 : -1)).join('');
}

/* ------------------------------------------------------------------ */
/* JWT HS256                                                           */
/* ------------------------------------------------------------------ */

const b64url = (buffer) => Buffer.from(buffer).toString('base64url');

function firmar(contenido) {
  return createHmac('sha256', secreto()).update(contenido).digest('base64url');
}

export function emitirToken(usuario) {
  const ahoraSeg = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(usuario.id),
    rol: usuario.rol,
    em: usuario.email,
    nombre: usuario.nombre,
    iat: ahoraSeg,
    exp: ahoraSeg + config.accessTtlMin * 60,
    jti: randomUUID(),
  };
  const cabecera = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const cuerpo = b64url(JSON.stringify(payload));
  const firma = firmar(`${cabecera}.${cuerpo}`);
  return {
    token: `${cabecera}.${cuerpo}.${firma}`,
    expiraEn: new Date(payload.exp * 1000).toISOString(),
    payload,
  };
}

export function verificarToken(token) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [cabecera, cuerpo, firma] = partes;
  const esperada = firmar(`${cabecera}.${cuerpo}`);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload?.sub || !payload.exp) return null;
  if (payload.exp * 1000 <= Date.now()) return null;
  return payload;
}

/* ------------------------------------------------------------------ */
/* Refresh tokens y cookies                                            */
/* ------------------------------------------------------------------ */

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function nuevoRefreshToken() {
  return randomBytes(40).toString('base64url');
}

export function cookiesDe(cabecera) {
  const salida = {};
  if (!cabecera) return salida;
  for (const parte of cabecera.split(';')) {
    const indice = parte.indexOf('=');
    if (indice < 0) continue;
    const clave = parte.slice(0, indice).trim();
    const valor = parte.slice(indice + 1).trim();
    if (clave) salida[clave] = decodeURIComponent(valor);
  }
  return salida;
}

export function cookie(nombre, valor, opciones = {}) {
  const partes = [`${nombre}=${encodeURIComponent(valor)}`, 'Path=/', 'SameSite=Strict'];
  if (opciones.httpOnly !== false) partes.push('HttpOnly');
  if (opciones.secure ?? Boolean(config.tls.key)) partes.push('Secure');
  if (opciones.maxAge !== undefined) partes.push(`Max-Age=${Math.floor(opciones.maxAge)}`);
  return partes.join('; ');
}

export function tokenCsrf() {
  return randomBytes(24).toString('base64url');
}
