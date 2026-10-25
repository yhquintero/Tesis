import { api } from './api.js';
import { sesion, puede, esAdmin } from './sesion.js';
import {
  aviso,
  campo,
  cargando,
  h,
  icono,
  iconoNodo,
  modal,
  rolEtiqueta,
  toast,
  vaciar,
} from './ui.js';
import { renderLogin } from './pages/login.js';
import { renderPanel } from './pages/panel.js';
import { renderProfesores } from './pages/profesores.js';
import { renderContratos } from './pages/contratos.js';
import { renderPagos } from './pages/pagos.js';
import { renderPrenomina } from './pages/prenomina.js';
import { renderUsuarios } from './pages/usuarios.js';
import { renderConfiguracion } from './pages/configuracion.js';
import { renderAuditoria } from './pages/auditoria.js';
import { renderAyuda } from './pages/ayuda.js';

const RUTAS = {
  panel: {
    titulo: 'Panel de control',
    subtitulo: 'Resumen operativo del departamento',
    icono: 'panel',
    modulo: 'dashboard',
    render: renderPanel,
  },
  profesores: {
    titulo: 'Profesores',
    subtitulo: 'Registro, categorías y carga docente',
    icono: 'grupos',
    modulo: 'profesores',
    render: renderProfesores,
  },
  contratos: {
    titulo: 'Contratos',
    subtitulo: 'Determinados y por sobrecarga',
    icono: 'contratos',
    modulo: 'contratos',
    render: renderContratos,
  },
  pagos: {
    titulo: 'Pagos por sobrecarga',
    subtitulo: 'Liquidación y control de plazos',
    icono: 'pagos',
    modulo: 'pagos',
    render: renderPagos,
  },
  prenomina: {
    titulo: 'Prenómina',
    subtitulo: 'Horas por corte y cálculo de pagos',
    icono: 'prenomina',
    modulo: 'prenomina',
    render: renderPrenomina,
  },
  usuarios: {
    titulo: 'Usuarios',
    subtitulo: 'Cuentas, roles, permisos y recuperación',
    icono: 'usuarios',
    modulo: 'usuarios',
    soloAdmin: true,
    render: renderUsuarios,
  },
  configuracion: {
    titulo: 'Configuración',
    subtitulo: 'Parámetros, tarifas y respaldos',
    icono: 'configuracion',
    modulo: 'configuracion',
    soloAdmin: true,
    render: renderConfiguracion,
  },
  auditoria: {
    titulo: 'Auditoría',
    subtitulo: 'Trazabilidad de acciones críticas',
    icono: 'auditoria',
    modulo: 'auditoria',
    soloAdmin: true,
    render: renderAuditoria,
  },
  ayuda: {
    titulo: 'Ayuda y soporte',
    subtitulo: 'Guía, reglas de negocio y contacto',
    icono: 'ayuda',
    modulo: 'ayuda',
    render: renderAyuda,
  },
};

const MENU_OPERACION = ['panel', 'profesores', 'contratos', 'pagos', 'prenomina'];
const MENU_ADMIN = ['usuarios', 'configuracion', 'auditoria'];
const MENU_MOVIL = ['panel', 'profesores', 'contratos', 'pagos', 'prenomina'];

const app = document.getElementById('app');
let contenido = null;
let tituloNodo = null;
let subtituloNodo = null;
let montado = false;

/* ------------------------------------------------------------------ */
/* Arranque y sesión                                                   */
/* ------------------------------------------------------------------ */

async function arrancar() {
  if (!document.cookie.includes('pn_csrf=')) {
    renderLogin(app, { onEntrar: entrar });
    return;
  }
  try {
    const { usuario } = await api.me();
    await iniciarApp(usuario);
  } catch (error) {
    if (error.codigo === 'SIN_RED') {
      pantallaSinServidor(error.message);
      return;
    }
    renderLogin(app, { onEntrar: entrar });
  }
}

async function entrar(email, password) {
  await api.login(email, password);
  const { usuario } = await api.me();
  await iniciarApp(usuario);
  toast(`Bienvenido, ${usuario.nombre}.`, 'exito');
}

async function iniciarApp(usuario) {
  sesion.usuario = usuario;
  try {
    sesion.catalogos = await api.catalogos();
  } catch {
    sesion.catalogos = {};
  }
  if (usuario.rol === 'admin') {
    try {
      sesion.configuracion = (await api.configuracion()).configuracion;
    } catch {
      sesion.configuracion = null;
    }
  } else {
    sesion.configuracion = {
      nombre_institucion: 'Universidad de Pinar del Río «Hermanos Saíz Montes de Oca»',
      departamento: 'Departamento de Informática',
      correo_soporte: 'soporte@upr.edu.cu',
      telefono_soporte: '+53 48 75 0000',
      simbolo_moneda: sesion.catalogos?.simboloMoneda || '$',
    };
  }
  if (usuario.debeCambiarClave) {
    pantallaCambioObligatorio();
    return;
  }
  montarShell();
  await navegar();
}

function salir() {
  api.logout().finally(() => {
    sesion.usuario = null;
    montado = false;
    renderLogin(app, { onEntrar: entrar });
    toast('Sesión cerrada.', 'info');
  });
}

/* ------------------------------------------------------------------ */
/* Pantallas especiales                                                */
/* ------------------------------------------------------------------ */

function pantallaSinServidor(mensaje) {
  app.replaceChildren(
    h(
      'div',
      { class: 'login' },
      h(
        'div',
        { class: 'login-tarjeta', estilo: { textAlign: 'center' } },
        h('div', { class: 'marca-logo', html: icono('servidor'), estilo: { margin: '0 auto 14px' } }),
        h('h1', {}, 'Servidor local no disponible'),
        h('p', {}, mensaje),
        h(
          'p',
          { class: 'kpi-detalle' },
          'Inicie el servidor con «npm start» en la carpeta del proyecto y actualice esta página.',
        ),
        h(
          'button',
          { class: 'btn', type: 'button', on: { click: () => window.location.reload() } },
          'Reintentar',
        ),
      ),
    ),
  );
}

function pantallaCambioObligatorio() {
  app.replaceChildren(
    h(
      'div',
      { class: 'login' },
      h(
        'div',
        { class: 'login-tarjeta' },
        h(
          'div',
          { class: 'marca' },
          h('div', { class: 'marca-logo', html: icono('candado') }),
          h('h1', {}, 'Cambie su contraseña'),
          h('p', {}, 'Por seguridad debe reemplazar la clave temporal antes de continuar.'),
        ),
        formularioClave(true),
      ),
    ),
  );
}

function formularioClave(obligatorio = false) {
  const mensaje = h('div');
  const actual = campo({ etiqueta: 'Contraseña actual', nombre: 'actual', tipo: 'password', requerido: true });
  const nueva = campo({
    etiqueta: 'Nueva contraseña',
    nombre: 'nueva',
    tipo: 'password',
    requerido: true,
    ayuda: 'Mínimo 8 caracteres, con letras, números y un símbolo.',
  });
  const repetir = campo({ etiqueta: 'Repetir nueva contraseña', nombre: 'repetir', tipo: 'password', requerido: true });
  return h(
    'form',
    {
      on: {
        submit: async (evento) => {
          evento.preventDefault();
          mensaje.replaceChildren();
          if (nueva.control.value !== repetir.control.value) {
            mensaje.append(aviso('Las contraseñas no coinciden.', 'error'));
            return;
          }
          try {
            await api.password(actual.control.value, nueva.control.value);
            toast('Contraseña actualizada. Inicie sesión nuevamente.', 'exito', 6000);
            setTimeout(() => {
              sesion.usuario = null;
              window.location.hash = '';
              window.location.reload();
            }, 1200);
          } catch (error) {
            mensaje.append(aviso(error.message, 'error'));
          }
        },
      },
    },
    actual,
    nueva,
    repetir,
    mensaje,
    h(
      'button',
      { class: 'btn', type: 'submit', estilo: { width: '100%', marginTop: '8px' } },
      'Cambiar contraseña',
    ),
    obligatorio
      ? h(
          'button',
          {
            class: 'btn plano',
            type: 'button',
            estilo: { width: '100%', marginTop: '6px' },
            on: { click: salir },
          },
          'Cerrar sesión',
        )
      : null,
  );
}

function abrirMiCuenta() {
  const usuario = sesion.usuario;
  const cuerpo = h(
    'div',
    { class: 'rejilla' },
    h(
      'dl',
      {},
      ...[
        ['Nombre', usuario.nombre],
        ['Correo', usuario.email],
        ['Rol', rolEtiqueta(usuario.rol)],
        ['Estado', usuario.estado],
        ['Último acceso', usuario.ultimoAcceso ? new Date(usuario.ultimoAcceso).toLocaleString('es-CU') : '—'],
      ].map(([etiqueta, valor]) =>
        h('div', { class: 'fila-dato' }, h('dt', {}, etiqueta), h('dd', {}, valor)),
      ),
    ),
    h('h3', {}, 'Cambiar contraseña'),
    formularioClave(false),
  );
  const dialogo = modal({
    titulo: 'Mi cuenta',
    contenido: cuerpo,
    pie: [
      h('button', { class: 'btn secundario', type: 'button', on: { click: salir } }, 'Cerrar sesión'),
      h('button', { class: 'btn', type: 'button', on: { click: () => dialogo.cerrar() } }, 'Cerrar'),
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

function enlaceNav(nombre, movil = false) {
  const ruta = RUTAS[nombre];
  return h(
    'a',
    { href: `#/${nombre}`, dataset: { ruta: nombre }, 'aria-label': ruta.titulo },
    h('span', { html: icono(ruta.icono), estilo: { display: 'inline-flex' } }),
    h('span', {}, movil ? ruta.titulo.split(' ')[0] : ruta.titulo),
  );
}

function montarShell() {
  if (montado) return;
  montado = true;
  tituloNodo = h('h1', {}, 'Panel de control');
  subtituloNodo = h('span', { class: 'sub' }, 'Resumen operativo del departamento');
  contenido = h('main', { id: 'contenido', class: 'principal', tabindex: '-1' });

  const navOperacion = h(
    'nav',
    { class: 'nav', 'aria-label': 'Operación' },
    h('span', { class: 'nav-separador' }, 'Operación'),
    ...MENU_OPERACION.filter((clave) => puede(RUTAS[clave].modulo, 'leer')).map((clave) => enlaceNav(clave)),
  );
  const navAdmin = esAdmin()
    ? h(
        'nav',
        { class: 'nav', 'aria-label': 'Administración' },
        h('span', { class: 'nav-separador' }, 'Administración'),
        ...MENU_ADMIN.map((clave) => enlaceNav(clave)),
      )
    : h('nav', { class: 'nav', 'aria-label': 'Ayuda' }, enlaceNav('ayuda'));

  const usuario = sesion.usuario;
  const iniciales = usuario.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();

  const shell = h(
    'div',
    { class: 'app-shell' },
    h(
      'aside',
      { class: 'barra-lateral' },
      h(
        'div',
        { class: 'barra-marca' },
        h('div', { class: 'escudo', html: icono('escudo') }),
        h('div', {}, h('strong', {}, 'Prenómina UPR'), h('span', {}, 'Contratos y sobrecarga')),
      ),
      navOperacion,
      navAdmin,
      h(
        'div',
        { class: 'barra-pie' },
        h(
          'div',
          { class: 'usuario-chip' },
          h('div', { class: 'avatar' }, iniciales),
          h('div', {}, h('strong', {}, usuario.nombre), h('span', {}, rolEtiqueta(usuario.rol))),
        ),
        h(
          'button',
          {
            class: 'btn secundario pequeno',
            type: 'button',
            on: { click: abrirMiCuenta },
            estilo: { color: '#e9f4ea', borderColor: 'rgba(255,255,255,.35)', background: 'transparent' },
          },
          h('span', { html: icono('candado'), estilo: { display: 'inline-flex' } }),
          'Mi cuenta',
        ),
      ),
    ),
    h(
      'div',
      { class: 'contenido' },
      h(
        'header',
        { class: 'cabecera' },
        h('div', { estilo: { flex: 1, minWidth: 0 } }, tituloNodo, subtituloNodo),
        h(
          'div',
          { class: 'cabecera-acciones' },
          h(
            'button',
            {
              class: 'icono-btn',
              type: 'button',
              title: 'Actualizar datos',
              'aria-label': 'Actualizar datos',
              html: icono('sincronizar'),
              on: { click: () => navegar(true) },
            },
          ),
          h(
            'button',
            {
              class: 'icono-btn',
              type: 'button',
              title: 'Cerrar sesión',
              'aria-label': 'Cerrar sesión',
              html: icono('salir'),
              on: { click: salir },
            },
          ),
        ),
      ),
      contenido,
    ),
    h(
      'nav',
      { class: 'nav-movil', 'aria-label': 'Navegación principal' },
      ...MENU_MOVIL.filter((clave) => puede(RUTAS[clave].modulo, 'leer')).map((clave) => enlaceNav(clave, true)),
      h(
        'a',
        {
          href: esAdmin() ? '#/configuracion' : '#/ayuda',
          dataset: { ruta: esAdmin() ? 'configuracion' : 'ayuda' },
          'aria-label': esAdmin() ? 'Configuración' : 'Ayuda',
        },
        h('span', { html: icono(esAdmin() ? 'configuracion' : 'ayuda'), estilo: { display: 'inline-flex' } }),
        h('span', {}, esAdmin() ? 'Ajustes' : 'Ayuda'),
      ),
    ),
  );

  app.replaceChildren(shell);
  window.addEventListener('hashchange', () => navegar());
}

function rutaActual() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [nombre, cadena] = hash.split('?');
  return { nombre: nombre || 'panel', consulta: new URLSearchParams(cadena || '') };
}

function permitida(nombre) {
  const ruta = RUTAS[nombre];
  if (!ruta) return false;
  if (ruta.soloAdmin) return esAdmin();
  if (nombre === 'ayuda') return true;
  return puede(ruta.modulo, 'leer');
}

async function navegar(forzar = false) {
  if (!sesion.usuario || !contenido) return;
  const { nombre, consulta } = rutaActual();
  const clave = RUTAS[nombre] ? nombre : 'panel';
  const ruta = RUTAS[clave];
  if (!permitida(clave)) {
    toast('Su rol no tiene acceso a esa sección.', 'error');
    window.location.hash = '#/panel';
    return;
  }
  tituloNodo.textContent = ruta.titulo;
  subtituloNodo.textContent = ruta.subtitulo;
  document.title = `${ruta.titulo} · Prenómina UPR`;
  for (const enlace of document.querySelectorAll('[data-ruta]')) {
    if (enlace.dataset.ruta === clave) enlace.setAttribute('aria-current', 'page');
    else enlace.removeAttribute('aria-current');
  }
  vaciar(contenido);
  contenido.append(cargando());
  try {
    await ruta.render(contenido, {
      usuario: sesion.usuario,
      catalogos: sesion.catalogos,
      configuracion: sesion.configuracion,
      consulta,
    });
  } catch (error) {
    if (error.status === 401) {
      sesion.usuario = null;
      renderLogin(app, { onEntrar: entrar });
      toast('Su sesión expiró. Inicie sesión nuevamente.', 'error');
      return;
    }
    contenido.replaceChildren(aviso(error.message || 'No se pudo cargar la sección.', 'error'));
    console.error(error);
  }
  contenido.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: forzar ? 'auto' : 'smooth' });
}

/* ------------------------------------------------------------------ */
/* Eventos globales y PWA                                              */
/* ------------------------------------------------------------------ */

window.addEventListener('sesion-expirada', () => {
  sesion.usuario = null;
  montado = false;
  renderLogin(app, { onEntrar: entrar });
  toast('Su sesión expiró. Inicie sesión nuevamente.', 'error');
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sin service worker la app sigue funcionando con red local */
    });
  });
}

arrancar();
