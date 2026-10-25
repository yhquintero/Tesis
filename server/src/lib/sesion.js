import { timingSafeEqual } from 'node:crypto';
import { get } from '../db.js';
import { verificarToken } from '../auth.js';
import { errores } from './http.js';

const MODULOS_POR_ROL = {
  admin: ['*'],
  determinado: [
    'dashboard',
    'profesores',
    'contratos',
    'prenomina',
    'pagos',
    'reportes',
    'periodos',
    'tarifas',
  ],
  sobrecarga: [
    'dashboard',
    'profesores',
    'contratos',
    'prenomina',
    'pagos',
    'reportes',
    'periodos',
    'tarifas',
  ],
};

const MODULOS_ESCRITURA = {
  admin: ['*'],
  determinado: ['profesores', 'contratos', 'prenomina'],
  sobrecarga: ['pagos'],
};

const ACCION_A_PERMISO = {
  crear: 'crear',
  leer: 'leer',
  actualizar: 'actualizar',
  eliminar: 'eliminar',
};

export function permisosDe(usuario) {
  try {
    const p = JSON.parse(usuario.permisos || '{}');
    return {
      crear: p.crear !== false,
      leer: p.leer !== false,
      actualizar: p.actualizar !== false,
      eliminar: p.eliminar !== false,
    };
  } catch {
    return { crear: true, leer: true, actualizar: true, eliminar: true };
  }
}

export function puede(usuario, modulo, accion) {
  if (!usuario) return false;
  if (usuario.rol === 'admin') return true;
  const modulos = MODULOS_POR_ROL[usuario.rol] || [];
  if (!modulos.includes(modulo)) return false;
  const permisos = permisosDe(usuario);
  const permiso = ACCION_A_PERMISO[accion];
  if (!permiso) return false;
  if (permiso === 'leer') return permisos.leer;
  const escribibles = MODULOS_ESCRITURA[usuario.rol] || [];
  return escribibles.includes(modulo) && permisos[permiso];
}

export function sanitizarUsuario(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    email: fila.email,
    nombre: fila.nombre,
    rol: fila.rol,
    estado: fila.estado,
    permisos: permisosDe(fila),
    debeCambiarClave: Boolean(fila.debe_cambiar_clave),
    intentosFallidos: fila.intentos_fallidos,
    bloqueadoHasta: fila.bloqueado_hasta,
    ultimoAcceso: fila.ultimo_acceso,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

function igualSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Autentica la solicitud y, si se indica, comprueba el permiso del módulo/acción.
 * Devuelve el usuario de base de datos (fila completa).
 */
export function autenticar(ctx, { modulo, accion } = {}) {
  const cabecera = String(ctx.req.headers.authorization || '');
  const bearer = cabecera.toLowerCase().startsWith('bearer ') ? cabecera.slice(7).trim() : '';
  const porCookie = !bearer;
  const token = bearer || ctx.cookies.pn_sesion || '';
  const payload = verificarToken(token);
  if (!payload) throw errores.noAutenticado('Su sesión expiró. Inicie sesión nuevamente.');

  if (porCookie && !['GET', 'HEAD'].includes(ctx.req.method)) {
    const csrfCabecera = String(ctx.req.headers['x-csrf-token'] || '');
    const csrfCookie = ctx.cookies.pn_csrf || '';
    if (!csrfCabecera || !csrfCookie || !igualSeguro(csrfCabecera, csrfCookie)) {
      throw errores.sinPermiso('La solicitud no pudo verificarse (CSRF). Recargue la página.');
    }
  }

  const usuario = get('SELECT * FROM usuarios WHERE id = ?', Number(payload.sub));
  if (!usuario) throw errores.noAutenticado('El usuario ya no existe.');
  if (usuario.estado !== 'aprobado') {
    throw errores.sinPermiso('Su cuenta no está aprobada o fue desactivada.');
  }
  if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
    throw errores.sinPermiso('La cuenta está bloqueada temporalmente.');
  }
  ctx.usuario = usuario;
  ctx.tokenPayload = payload;

  if (modulo && accion && !puede(usuario, modulo, accion)) {
    throw errores.sinPermiso(
      `Su rol (${usuario.rol}) no permite ${accion} en ${modulo}.`,
    );
  }
  return usuario;
}

export function soloAdmin(ctx) {
  const usuario = autenticar(ctx);
  if (usuario.rol !== 'admin') throw errores.sinPermiso('Solo un administrador puede realizar esta acción.');
  return usuario;
}
