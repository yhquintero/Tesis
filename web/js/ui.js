import { api } from './api.js';

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */

export function h(etiqueta, atributos = {}, ...hijos) {
  const elemento = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'clase' || clave === 'class') elemento.className = valor;
    else if (clave === 'html') elemento.innerHTML = valor;
    else if (clave === 'texto') elemento.textContent = valor;
    else if (clave === 'on') {
      for (const [evento, manejador] of Object.entries(valor)) {
        elemento.addEventListener(evento, manejador);
      }
    } else if (clave === 'dataset') Object.assign(elemento.dataset, valor);
    else if (clave === 'estilo') Object.assign(elemento.style, valor);
    else if (['value', 'checked', 'selected', 'disabled', 'indeterminate'].includes(clave)) {
      elemento[clave] = valor;
    } else {
      elemento.setAttribute(clave, valor === true ? '' : String(valor));
    }
  }
  for (const hijo of hijos.flat(10)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    elemento.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return elemento;
}

export function vaciar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  return nodo;
}

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ------------------------------------------------------------------ */
/* Iconos                                                              */
/* ------------------------------------------------------------------ */

const TRAZOS = {
  panel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  grupos: '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  contratos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/>',
  pagos: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  prenomina: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 10h2"/><path d="M14 10h2"/><path d="M8 14h2"/><path d="M14 14h2"/><path d="M8 18h8"/>',
  usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  configuracion: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.36.4.66.74.86.3.18.65.28 1 .28H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  auditoria: '<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>',
  ayuda: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  mas: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  borrar: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6"/>',
  excel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/><path d="M3 15h18"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  sincronizar: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/>',
  cerrar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  candado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  correo: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  servidor: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01"/><path d="M7 16.5h.01"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  dinero: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  flecha: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  carpeta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  grafico: '<path d="M3 3v18h18"/><path d="M7 15v-4"/><path d="M12 17V7"/><path d="M17 13V9"/>',
};

export function icono(nombre, clase = '') {
  const trazo = TRAZOS[nombre] || TRAZOS.panel;
  return `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${trazo}</svg>`;
}

export function iconoNodo(nombre) {
  const plantilla = document.createElement('template');
  plantilla.innerHTML = icono(nombre);
  return plantilla.content.firstElementChild;
}

/* ------------------------------------------------------------------ */
/* Formato                                                             */
/* ------------------------------------------------------------------ */

export function dinero(valor, simbolo = '$') {
  const numero = Number(valor) || 0;
  return (
    simbolo +
    numero.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function numero(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
}

export function fecha(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function fechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export function sumarDias(iso, dias) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export const ETIQUETA_ESTADO = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  activo: 'Activo',
  completado: 'Completado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
  pagado: 'Pagado',
  anulado: 'Anulado',
};

const COLOR_ESTADO = {
  borrador: 'gris',
  pendiente: 'ambar',
  aprobado: 'azul',
  activo: 'verde',
  completado: 'teal',
  rechazado: 'rojo',
  cancelado: 'gris',
  pagado: 'verde',
  anulado: 'gris',
};

const COLORES_CHIP = new Set(['verde', 'azul', 'ambar', 'rojo', 'gris', 'teal', 'oro']);

export function chip(estado, etiqueta) {
  const clase = COLORES_CHIP.has(estado) ? estado : COLOR_ESTADO[estado] || 'gris';
  return h(
    'span',
    { class: `chip ${clase}` },
    etiqueta || ETIQUETA_ESTADO[estado] || estado,
  );
}

export function rolEtiqueta(rol) {
  return { admin: 'Administrador', determinado: 'Determinado', sobrecarga: 'Sobrecarga' }[rol] || rol;
}

/* ------------------------------------------------------------------ */
/* Avisos y modales                                                    */
/* ------------------------------------------------------------------ */

export function toast(mensaje, tipo = 'info', ms = 4200) {
  const contenedor = document.getElementById('toasts');
  if (!contenedor) return;
  const aviso = h(
    'div',
    { class: `toast ${tipo}`, role: 'alert' },
    h('span', { html: icono(tipo === 'error' ? 'alerta' : 'check'), estilo: { width: '18px' } }),
    h('span', {}, String(mensaje)),
  );
  contenedor.append(aviso);
  const cerrar = () => {
    aviso.style.opacity = '0';
    setTimeout(() => aviso.remove(), 180);
  };
  aviso.addEventListener('click', cerrar);
  setTimeout(cerrar, ms);
}

export function modal({ titulo, contenido, pie, ancho = false, alCerrar }) {
  const anterior = document.activeElement;
  const tituloId = `modal-${Math.random().toString(36).slice(2)}`;
  const cuerpo = h('div', { class: 'modal-cuerpo' }, contenido);
  const caja = h(
    'div',
    {
      class: `modal${ancho ? ' ancho' : ''}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': tituloId,
    },
    h(
      'div',
      { class: 'modal-cabecera' },
      h('h2', { id: tituloId }, titulo),
      h(
        'button',
        {
          class: 'icono-btn',
          type: 'button',
          'aria-label': 'Cerrar',
          on: { click: () => cerrar() },
          html: icono('cerrar'),
        },
      ),
    ),
    cuerpo,
  );
  if (pie) caja.append(h('div', { class: 'modal-pie' }, pie));
  const fondo = h('div', {
    class: 'modal-fondo',
    on: {
      mousedown: (evento) => {
        if (evento.target === fondo) cerrar();
      },
    },
  }, caja);

  function cerrar() {
    document.removeEventListener('keydown', tecla);
    fondo.remove();
    document.body.style.overflow = '';
    if (alCerrar) alCerrar();
    if (anterior?.focus) anterior.focus();
  }

  function tecla(evento) {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      cerrar();
      return;
    }
    if (evento.key !== 'Tab') return;
    const focos = [...caja.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(
      (nodo) => nodo.offsetParent !== null,
    );
    if (!focos.length) return;
    const primero = focos[0];
    const ultimo = focos[focos.length - 1];
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  document.getElementById('modal-raiz').append(fondo);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', tecla);
  const primerCampo = caja.querySelector('input,select,textarea,button:not(.icono-btn)');
  setTimeout(() => (primerCampo || caja).focus?.(), 20);
  return { cerrar, caja, cuerpo };
}

export function confirmar({ titulo, mensaje, texto = 'Confirmar', peligro = false }) {
  return new Promise((resolver) => {
    let decidido = false;
    const cerrarCon = (valor) => {
      if (decidido) return;
      decidido = true;
      dialogo.cerrar();
      resolver(valor);
    };
    const dialogo = modal({
      titulo,
      contenido: h('p', { estilo: { margin: 0 } }, mensaje),
      pie: [
        h(
          'button',
          { class: 'btn secundario', type: 'button', on: { click: () => cerrarCon(false) } },
          'Cancelar',
        ),
        h(
          'button',
          {
            class: `btn${peligro ? ' peligro' : ''}`,
            type: 'button',
            on: { click: () => cerrarCon(true) },
          },
          texto,
        ),
      ],
      alCerrar: () => {
        if (!decidido) {
          decidido = true;
          resolver(false);
        }
      },
    });
  });
}

/* ------------------------------------------------------------------ */
/* Componentes de formulario                                           */
/* ------------------------------------------------------------------ */

let contadorId = 0;

export function campo({
  etiqueta,
  nombre,
  valor = '',
  tipo = 'text',
  requerido = false,
  placeholder = '',
  ayuda = '',
  error = '',
  opciones = null,
  filas = 0,
  deshabilitado = false,
}) {
  const id = `campo-${nombre}-${++contadorId}`;
  let control;  if (opciones) {
    control = h(
      'select',
      { id, name: nombre, requerido, deshabilitado },
      ...opciones.map((opcion) => {
        const valorOpcion = typeof opcion === 'string' ? opcion : opcion.valor;
        const texto = typeof opcion === 'string' ? opcion : opcion.etiqueta;
        return h('option', { value: valorOpcion }, texto);
      }),
    );
    control.value = valor ?? '';
  } else if (filas > 0) {
    control = h('textarea', { id, name: nombre, requerido, placeholder, rows: filas, deshabilitado });
    control.value = valor ?? '';
  } else {
    control = h('input', { id, name: nombre, type: tipo, requerido, placeholder, deshabilitado });
    control.value = valor ?? '';
  }
  control.setAttribute('aria-label', etiqueta);
  const contenedor = h(
    'div',
    { class: `campo${error ? ' error' : ''}` },
    h('label', { for: id }, etiqueta, requerido ? ' *' : ''),
    control,
    error ? h('span', { class: 'error', role: 'alert' }, error) : null,
    ayuda ? h('span', { class: 'ayuda' }, ayuda) : null,
  );
  contenedor.control = control;
  return contenedor;
}

export function valorDe(nodo) {
  const control = nodo.control || nodo.querySelector('input,select,textarea');
  return control ? control.value.trim() : '';
}

export function datosFormulario(formulario) {
  const datos = {};
  for (const [clave, valor] of new FormData(formulario).entries()) {
    datos[clave] = typeof valor === 'string' ? valor.trim() : valor;
  }
  return datos;
}

/* ------------------------------------------------------------------ */
/* Tablas y paginación                                                 */
/* ------------------------------------------------------------------ */

export function tabla({ columnas, filas, vacio = 'No hay registros para mostrar.' }) {
  if (!filas.length) {
    return h(
      'div',
      { class: 'vacio' },
      h('strong', {}, 'Sin resultados'),
      h('span', {}, vacio),
    );
  }
  const encabezado = h(
    'tr',
    {},
    ...columnas.map((col) => h('th', { scope: 'col', class: col.clase || '' }, col.titulo)),
  );
  const cuerpo = h(
    'tbody',
    {},
    ...filas.map((fila) =>
      h(
        'tr',
        {},
        ...columnas.map((col) =>
          h(
            'td',
            { class: col.clase || '' },
            col.render ? col.render(fila) : fila[col.clave] ?? '—',
          ),
        ),
      ),
    ),
  );
  return h(
    'div',
    { class: 'tabla-envoltura' },
    h('table', { class: 'tabla' }, h('thead', {}, encabezado), cuerpo),
  );
}

export function paginacion({ page = 1, paginas = 1, total = 0, onCambio }) {
  return h(
    'div',
    { class: 'paginacion' },
    h('span', {}, `${total} registro(s) · página ${page} de ${paginas}`),
    h(
      'div',
      {},
      h(
        'button',
        {
          class: 'btn secundario pequeno',
          type: 'button',
          disabled: page <= 1,
          on: { click: () => onCambio(page - 1) },
        },
        'Anterior',
      ),
      h(
        'button',
        {
          class: 'btn secundario pequeno',
          type: 'button',
          disabled: page >= paginas,
          on: { click: () => onCambio(page + 1) },
        },
        'Siguiente',
      ),
    ),
  );
}

export function cargando(texto = 'Cargando información…') {
  return h(
    'div',
    { class: 'cargando', role: 'status' },
    h('div', { class: 'spinner', 'aria-hidden': 'true' }),
    h('span', {}, texto),
  );
}

export function aviso(mensaje, tipo = '') {
  return h('div', { class: `aviso ${tipo}`.trim(), role: tipo === 'error' ? 'alert' : 'status' }, mensaje);
}

export function descargar(ruta, nombre) {
  toast('Generando el archivo…', 'info', 2200);
  return api.descargar(ruta, nombre).catch((error) => toast(error.message, 'error'));
}

export function botonDescarga(etiqueta, iconoNombre, ruta, nombre) {
  return h(
    'button',
    {
      class: 'btn secundario',
      type: 'button',
      on: { click: () => descargar(ruta, nombre) },
    },
    h('span', { html: icono(iconoNombre), estilo: { display: 'inline-flex' } }),
    etiqueta,
  );
}
