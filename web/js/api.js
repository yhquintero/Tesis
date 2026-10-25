const BASE = '/api';

export class ApiError extends Error {
  constructor(status, codigo, mensaje, campos) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos || {};
  }
}

function csrfToken() {
  const match = document.cookie.match(/(?:^|; )pn_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

let refrescando = null;

async function renovarSesion() {
  if (!refrescando) {
    refrescando = fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => {
          refrescando = null;
        }, 0);
      });
  }
  return refrescando;
}

async function peticion(ruta, { method = 'GET', body, raw = false, reintentar = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const csrf = csrfToken();
  if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;

  let respuesta;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'SIN_RED', 'No hay conexión con el servidor local. Compruebe que esté iniciado.');
  }

  if (respuesta.status === 401 && reintentar && !ruta.startsWith('/auth/login')) {
    const ok = await renovarSesion();
    if (ok) return peticion(ruta, { method, body, raw, reintentar: false });
    window.dispatchEvent(new CustomEvent('sesion-expirada'));
  }

  if (raw) {
    if (!respuesta.ok) {
      let detalle = null;
      try {
        detalle = await respuesta.json();
      } catch {
        /* respuesta sin JSON */
      }
      throw new ApiError(
        respuesta.status,
        detalle?.error?.codigo || 'ERROR',
        detalle?.error?.mensaje || 'No se pudo descargar el archivo.',
      );
    }
    return respuesta;
  }

  let datos = null;
  const tipo = respuesta.headers.get('content-type') || '';
  if (tipo.includes('application/json')) {
    try {
      datos = await respuesta.json();
    } catch {
      datos = null;
    }
  }

  if (!respuesta.ok) {
    const err = datos?.error || {};
    throw new ApiError(
      respuesta.status,
      err.codigo || 'ERROR',
      err.mensaje || `Error ${respuesta.status}`,
      err.campos,
    );
  }
  return datos;
}

export const api = {
  peticion,
  login: (email, password) =>
    peticion('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => peticion('/auth/logout', { method: 'POST', body: {} }),
  me: () => peticion('/auth/me'),
  password: (actual, nueva) => peticion('/auth/password', { method: 'POST', body: { actual, nueva } }),
  recuperar: (email) => peticion('/auth/recuperar', { method: 'POST', body: { email } }),
  registro: (datos) => peticion('/registro', { method: 'POST', body: datos }),
  dashboard: () => peticion('/dashboard'),
  catalogos: () => peticion('/catalogos'),
  salud: () => peticion('/salud'),

  usuarios: (params = {}) => peticion(`/usuarios?${new URLSearchParams(params)}`),
  crearUsuario: (datos) => peticion('/usuarios', { method: 'POST', body: datos }),
  actualizarUsuario: (id, datos) => peticion(`/usuarios/${id}`, { method: 'PATCH', body: datos }),
  aprobarUsuario: (id, aprobar) =>
    peticion(`/usuarios/${id}/aprobar`, { method: 'POST', body: { aprobar } }),
  resetUsuario: (id) => peticion(`/usuarios/${id}/reset-password`, { method: 'POST', body: {} }),
  eliminarUsuario: (id) => peticion(`/usuarios/${id}`, { method: 'DELETE' }),

  profesores: (params = {}) => peticion(`/profesores?${new URLSearchParams(params)}`),
  profesor: (id) => peticion(`/profesores/${id}`),
  crearProfesor: (datos) => peticion('/profesores', { method: 'POST', body: datos }),
  actualizarProfesor: (id, datos) => peticion(`/profesores/${id}`, { method: 'PATCH', body: datos }),
  eliminarProfesor: (id) => peticion(`/profesores/${id}`, { method: 'DELETE' }),

  periodos: () => peticion('/periodos'),
  periodoActual: () => peticion('/periodos/actual'),
  crearPeriodo: (datos) => peticion('/periodos', { method: 'POST', body: datos }),
  cambiarPeriodo: (id, estado) => peticion(`/periodos/${id}`, { method: 'PATCH', body: { estado } }),
  prenomina: (periodoId) => peticion(`/prenomina${periodoId ? `?periodoId=${periodoId}` : ''}`),
  guardarHoras: (periodoId, profesorId, horas) =>
    peticion('/prenomina/horas', { method: 'PUT', body: { periodoId, profesorId, horas } }),
  generarContratos: (periodoId) =>
    peticion('/prenomina/generar-contratos', { method: 'POST', body: { periodoId } }),

  contratos: (params = {}) => peticion(`/contratos?${new URLSearchParams(params)}`),
  contrato: (id) => peticion(`/contratos/${id}`),
  crearContrato: (datos) => peticion('/contratos', { method: 'POST', body: datos }),
  actualizarContrato: (id, datos) => peticion(`/contratos/${id}`, { method: 'PATCH', body: datos }),
  estadoContrato: (id, estado, motivo) =>
    peticion(`/contratos/${id}/estado`, { method: 'POST', body: { estado, motivo } }),
  eliminarContrato: (id) => peticion(`/contratos/${id}`, { method: 'DELETE' }),

  pagos: (params = {}) => peticion(`/pagos?${new URLSearchParams(params)}`),
  crearPago: (datos) => peticion('/pagos', { method: 'POST', body: datos }),
  estadoPago: (id, estado, extra = {}) =>
    peticion(`/pagos/${id}/estado`, { method: 'POST', body: { estado, ...extra } }),
  contratosDisponibles: () => peticion('/pagos/contratos-disponibles'),
  periodosPago: () => peticion('/pagos/periodos'),

  tarifas: () => peticion('/tarifas'),
  guardarTarifa: (datos) => peticion('/tarifas', { method: 'POST', body: datos }),
  configuracion: () => peticion('/configuracion'),
  guardarConfiguracion: (datos) => peticion('/configuracion', { method: 'PUT', body: datos }),
  auditoria: (params = {}) => peticion(`/auditoria?${new URLSearchParams(params)}`),
  respaldos: () => peticion('/respaldos'),
  crearRespaldo: () => peticion('/respaldos', { method: 'POST', body: {} }),
  restaurarRespaldo: (id) => peticion(`/respaldos/${id}/restaurar`, { method: 'POST', body: {} }),
  recuperaciones: (estado = 'pendiente') =>
    peticion(`/recuperaciones?${new URLSearchParams({ estado })}`),
  atenderRecuperacion: (id, accion) =>
    peticion(`/recuperaciones/${id}/atender`, { method: 'POST', body: { accion } }),

  async descargar(ruta, nombre) {
    const respuesta = await peticion(ruta, { raw: true });
    const blob = await respuesta.blob();
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },
};
