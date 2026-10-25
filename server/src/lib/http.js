import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { config } from '../config.js';
import { cookiesDe } from '../auth.js';

export class HttpError extends Error {
  constructor(status, codigo, mensaje, campos) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

export const errores = {
  noAutenticado: (mensaje = 'Debe iniciar sesión para continuar.') =>
    new HttpError(401, 'NO_AUTENTICADO', mensaje),
  sinPermiso: (mensaje = 'No tiene permisos para realizar esta acción.') =>
    new HttpError(403, 'SIN_PERMISO', mensaje),
  noExiste: (mensaje = 'El registro solicitado no existe.') =>
    new HttpError(404, 'NO_EXISTE', mensaje),
  conflicto: (mensaje) => new HttpError(409, 'CONFLICTO', mensaje),
  regla: (mensaje, campos) => new HttpError(422, 'REGLA_NEGOCIO', mensaje, campos),
  validacion: (mensaje, campos) => new HttpError(400, 'VALIDACION', mensaje, campos),
  limite: (mensaje = 'Demasiados intentos. Espere unos minutos e intente de nuevo.') =>
    new HttpError(429, 'LIMITE_INTENTOS', mensaje),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function compilarRuta(patron) {
  const partes = patron.split('/').filter(Boolean);
  return {
    partes,
    dinamica: partes.some((p) => p.startsWith(':')),
  };
}

function coincidir(ruta, partes, rutaPartes) {
  if (partes.length !== rutaPartes.length) return null;
  const params = {};
  for (let i = 0; i < partes.length; i += 1) {
    const esperado = partes[i];
    if (esperado.startsWith(':')) {
      params[esperado.slice(1)] = decodeURIComponent(rutaPartes[i]);
    } else if (esperado !== rutaPartes[i]) {
      return null;
    }
  }
  return params;
}

function leerCuerpo(req) {
  return new Promise((resolvePromise, reject) => {
    const trozos = [];
    let total = 0;
    req.on('data', (trozo) => {
      total += trozo.length;
      if (total > config.maxBodyBytes) {
        reject(new HttpError(413, 'CUERPO_GRANDE', 'La solicitud supera el tamaño permitido.'));
        req.destroy();
        return;
      }
      trozos.push(trozo);
    });
    req.on('end', () => resolvePromise(Buffer.concat(trozos)));
    req.on('error', reject);
  });
}

function cabecerasSeguridad(res, esHtml) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (esHtml) {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    );
  }
  if (config.tls.key) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

export function crearApp({ registrarAuditoria } = {}) {
  const rutas = [];
  const registrar = (metodo, patron, manejador, opciones = {}) => {
    rutas.push({
      metodo,
      ...compilarRuta(patron),
      patron,
      manejador,
      publica: Boolean(opciones.publica),
      crudo: Boolean(opciones.crudo),
    });
  };

  const app = {
    get: (p, h, o) => registrar('GET', p, h, o),
    post: (p, h, o) => registrar('POST', p, h, o),
    put: (p, h, o) => registrar('PUT', p, h, o),
    patch: (p, h, o) => registrar('PATCH', p, h, o),
    delete: (p, h, o) => registrar('DELETE', p, h, o),
    rutas,
  };

  async function servirEstatico(req, res, ruta) {
    let relativa = decodeURIComponent(ruta);
    if (relativa === '/' || relativa === '') relativa = '/index.html';
    const candidato = resolve(join(config.webDir, normalize(relativa).replace(/^([/\\])+/, '')));
    if (!candidato.startsWith(resolve(config.webDir) + sep)) {
      throw errores.noExiste('Ruta no encontrada.');
    }
    let archivo = candidato;
    if (existsSync(archivo) && statSync(archivo).isDirectory()) archivo = join(archivo, 'index.html');
    if (!existsSync(archivo)) {
      // Fallback de la SPA: solo para navegación HTML, nunca para activos.
      const acepta = String(req.headers.accept || '');
      if (!acepta.includes('text/html') || extname(relativa)) {
        throw errores.noExiste('Ruta no encontrada.');
      }
      archivo = join(config.webDir, 'index.html');
    }
    const tipo = MIME[extname(archivo).toLowerCase()] || 'application/octet-stream';
    const esHtml = tipo.startsWith('text/html');
    cabecerasSeguridad(res, esHtml);
    const info = statSync(archivo);
    const etag = `W/"${info.size}-${Math.floor(info.mtimeMs)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304;
      res.end();
      return true;
    }
    res.setHeader('Content-Type', tipo);
    res.setHeader('ETag', etag);
    const cacheable = !esHtml && !archivo.endsWith('sw.js');
    res.setHeader('Cache-Control', cacheable ? 'public, max-age=3600' : 'no-cache');
    res.statusCode = 200;
    createReadStream(archivo).pipe(res);
    return true;
  }

  function contexto(req, res, url) {
    const ctx = {
      req,
      res,
      url,
      params: {},
      query: Object.fromEntries(url.searchParams.entries()),
      cuerpo: null,
      usuario: null,
      cookies: cookiesDe(req.headers.cookie),
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '',
      userAgent: req.headers['user-agent'] || '',
      json(datos, status = 200, extraHeaders = {}) {
        if (res.writableEnded) return;
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        for (const [k, v] of Object.entries(extraHeaders)) {
          if (Array.isArray(v)) res.setHeader(k, v);
          else res.setHeader(k, v);
        }
        res.end(JSON.stringify(datos));
      },
      enviar(buffer, tipo, status = 200, extraHeaders = {}) {
        if (res.writableEnded) return;
        res.statusCode = status;
        res.setHeader('Content-Type', tipo);
        res.setHeader('Cache-Control', 'no-store');
        for (const [k, val] of Object.entries(extraHeaders)) {
          res.setHeader(k, val);
        }
        res.end(buffer);
      },
      sinContenido(status = 204) {
        if (res.writableEnded) return;
        res.statusCode = status;
        res.end();
      },
      auditoria(accion, entidad, entidadId, detalle) {
        if (!registrarAuditoria) return;
        try {
          registrarAuditoria(this, { accion, entidad, entidadId, detalle });
        } catch (error) {
          console.error('[auditoria]', error.message);
        }
      },
    };
    return ctx;
  }

  const servidor = async (req, res) => {
    const inicio = process.hrtime.bigint();
    let ctx;
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      ctx = contexto(req, res, url);
      const rutaPartes = url.pathname.split('/').filter(Boolean);

      if (url.pathname.startsWith('/api/')) {
        let coincidencia = null;
        let metodoNoPermitido = false;
        for (const ruta of rutas) {
          const params = coincidir(url.pathname, ruta.partes, rutaPartes);
          if (!params) continue;
          if (ruta.metodo !== req.method) {
            metodoNoPermitido = true;
            continue;
          }
          coincidencia = { ruta, params };
          break;
        }
        if (!coincidencia) {
          if (metodoNoPermitido) throw new HttpError(405, 'METODO_NO_PERMITIDO', 'Método no permitido.');
          throw errores.noExiste('Ruta de API no encontrada.');
        }
        ctx.params = coincidencia.params;
        ctx.ruta = coincidencia.ruta;
        cabecerasSeguridad(res, false);

        if (req.method !== 'GET' && req.method !== 'DELETE') {
          const tipo = String(req.headers['content-type'] || '');
          const bruto = await leerCuerpo(req);
          if (tipo.includes('application/json') && bruto.length) {
            try {
              ctx.cuerpo = JSON.parse(bruto.toString('utf8'));
            } catch {
              throw errores.validacion('El cuerpo de la solicitud no es JSON válido.');
            }
          } else {
            ctx.cuerpo = {};
          }
        }

        const resultado = await coincidencia.ruta.manejador(ctx);
        if (resultado !== undefined && !res.writableEnded) {
          if (Buffer.isBuffer(resultado)) ctx.enviar(resultado, 'application/octet-stream');
          else ctx.json(resultado);
        }
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        throw errores.noExiste('Ruta no encontrada.');
      }
      await servirEstatico(req, res, url.pathname);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status >= 500) {
        console.error('[error]', req.method, req.url, error.stack || error.message);
      }
      if (!res.writableEnded) {
        cabecerasSeguridad(res, false);
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            error: {
              codigo: error.codigo || 'ERROR_INTERNO',
              mensaje:
                status >= 500
                  ? 'Ocurrió un error inesperado. Intente de nuevo o consulte los registros.'
                  : error.message,
              ...(error.campos ? { campos: error.campos } : {}),
            },
          }),
        );
      }
    } finally {
      const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
      if (String(req.url).startsWith('/api/')) {
        const usuario = ctx?.usuario?.email || '-';
        console.log(
          `${new Date().toISOString()} ${req.method} ${req.url.split('?')[0]} ${res.statusCode} ${ms.toFixed(0)}ms ${usuario}`,
        );
      }
    }
  };

  return { app, servidor };
}
