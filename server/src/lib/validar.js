import { HttpError } from './http.js';

const invalido = (campo, mensaje) =>
  new HttpError(400, 'VALIDACION', 'Revise los datos del formulario.', { [campo]: mensaje });

export function texto(valor, campo, { min = 1, max = 300, requerido = true, permitirVacio = false } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (requerido) throw invalido(campo, 'Este campo es obligatorio.');
    return permitirVacio ? '' : null;
  }
  const limpio = String(valor).replace(/\s+/g, ' ').trim();
  if (limpio.length < min) throw invalido(campo, `Debe tener al menos ${min} caracteres.`);
  if (limpio.length > max) throw invalido(campo, `No puede superar ${max} caracteres.`);
  return limpio;
}

export function email(valor, campo = 'email', { requerido = true } = {}) {
  const correo = texto(valor, campo, { requerido, max: 160 }).toLowerCase();
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
    throw invalido(campo, 'Formato de correo electrónico no válido.');
  }
  return correo;
}

export function entero(valor, campo, { min = 0, max = 1_000_000, requerido = true } = {}) {
  if ((valor === undefined || valor === null || valor === '') && !requerido) return null;
  const numero = Number(valor);
  if (!Number.isInteger(numero)) throw invalido(campo, 'Debe ser un número entero.');
  if (numero < min || numero > max) throw invalido(campo, `Debe estar entre ${min} y ${max}.`);
  return numero;
}

export function numero(valor, campo, { min = 0, max = 1_000_000, requerido = true, decimales = 2 } = {}) {
  if ((valor === undefined || valor === null || valor === '') && !requerido) return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) throw invalido(campo, 'Debe ser un número válido.');
  if (n < min || n > max) throw invalido(campo, `Debe estar entre ${min} y ${max}.`);
  const factor = 10 ** decimales;
  return Math.round(n * factor) / factor;
}

export function fecha(valor, campo, { requerido = true } = {}) {
  if (!valor) {
    if (requerido) throw invalido(campo, 'La fecha es obligatoria.');
    return null;
  }
  const s = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw invalido(campo, 'Use el formato AAAA-MM-DD.');
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw invalido(campo, 'La fecha no existe en el calendario.');
  }
  return s;
}

export function fechaHora(valor, campo = 'fecha', { requerido = true } = {}) {
  if (!valor) {
    if (requerido) throw invalido(campo, 'La fecha y hora son obligatorias.');
    return null;
  }
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) throw invalido(campo, 'Fecha y hora inválidas.');
  return d.toISOString();
}

export function booleano(valor, campo, { porDefecto = null } = {}) {
  if (valor === undefined || valor === null || valor === '') return porDefecto;
  if (typeof valor === 'boolean') return valor;
  if (['true', '1', 'si', 'sí', 'on'].includes(String(valor).toLowerCase())) return true;
  if (['false', '0', 'no', 'off'].includes(String(valor).toLowerCase())) return false;
  throw invalido(campo, 'Debe ser verdadero o falso.');
}

export function enumerado(valor, campo, opciones, { requerido = true, porDefecto = null } = {}) {
  if ((valor === undefined || valor === null || valor === '') && !requerido) return porDefecto;
  const v = String(valor);
  if (!opciones.includes(v)) {
    throw invalido(campo, `Debe ser uno de: ${opciones.join(', ')}.`);
  }
  return v;
}

export function arregloTexto(valor, campo, { max = 30, maxLargo = 2000 } = {}) {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) throw invalido(campo, 'Debe ser una lista de textos.');
  if (valor.length > max) throw invalido(campo, `No puede superar ${max} elementos.`);
  return valor.map((item, i) => {
    const t = String(item ?? '').trim();
    if (!t) throw invalido(`${campo}[${i}]`, 'El texto no puede estar vacío.');
    if (t.length > maxLargo) throw invalido(`${campo}[${i}]`, 'Texto demasiado largo.');
    return t;
  });
}

export function jsonObjeto(valor, campo, { requerido = false } = {}) {
  if (valor === undefined || valor === null) {
    if (requerido) throw invalido(campo, 'Este campo es obligatorio.');
    return null;
  }
  if (typeof valor !== 'object' || Array.isArray(valor)) {
    throw invalido(campo, 'Debe ser un objeto.');
  }
  return valor;
}

export function permisos(valor, campo = 'permisos') {
  const base = { crear: true, leer: true, actualizar: true, eliminar: true };
  if (valor === undefined || valor === null) return base;
  if (typeof valor !== 'object' || Array.isArray(valor)) throw invalido(campo, 'Permisos inválidos.');
  const salida = {};
  for (const clave of Object.keys(base)) {
    salida[clave] = booleano(valor[clave], `${campo}.${clave}`, { porDefecto: true });
  }
  return salida;
}

export function paginacion(query) {
  const page = Math.max(1, Math.min(10_000, Number.parseInt(query.page, 10) || 1));
  const limit = Math.max(1, Math.min(200, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

export function id(valor, campo = 'id') {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw invalido(campo, 'Identificador inválido.');
  return n;
}
