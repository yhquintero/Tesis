export const sesion = {
  usuario: null,
  catalogos: null,
  configuracion: null,
};

const MODULOS = {
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

const ESCRIBIBLES = {
  admin: ['*'],
  determinado: ['profesores', 'contratos', 'prenomina'],
  sobrecarga: ['pagos'],
};

export function esAdmin() {
  return sesion.usuario?.rol === 'admin';
}

export function puede(modulo, accion = 'leer') {
  const usuario = sesion.usuario;
  if (!usuario) return false;
  if (usuario.rol === 'admin') return true;
  if (!(MODULOS[usuario.rol] || []).includes(modulo)) return false;
  const permisos = usuario.permisos || {};
  if (accion === 'leer') return permisos.leer !== false;
  return (ESCRIBIBLES[usuario.rol] || []).includes(modulo) && permisos[accion] !== false;
}

export function catalogos() {
  return sesion.catalogos || {};
}

export function simboloMoneda() {
  return sesion.configuracion?.simbolo_moneda || '$';
}
