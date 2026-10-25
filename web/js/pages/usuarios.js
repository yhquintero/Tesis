import { api } from '../api.js';
import {
  aviso,
  cargando,
  chip,
  confirmar,
  debounce,
  h,
  icono,
  modal,
  paginacion,
  rolEtiqueta,
  tabla,
  toast,
  fechaHora,
} from '../ui.js';

const PERMISOS = [
  ['crear', 'Crear'],
  ['leer', 'Leer'],
  ['actualizar', 'Actualizar'],
  ['eliminar', 'Eliminar'],
];

export async function renderUsuarios(raiz) {
  const estado = { page: 1, limit: 20, q: '', rol: '', estado: '' };
  const lista = h('div');
  const paginador = h('div');
  const recuperaciones = h('div');

  const buscador = h('input', { type: 'search', placeholder: 'Buscar por correo o nombre', 'aria-label': 'Buscar usuarios' });
  const filtroRol = h(
    'select',
    { 'aria-label': 'Filtrar por rol' },
    h('option', { value: '' }, 'Todos los roles'),
    h('option', { value: 'admin' }, 'Administrador'),
    h('option', { value: 'determinado' }, 'Determinado'),
    h('option', { value: 'sobrecarga' }, 'Sobrecarga'),
  );
  const filtroEstado = h(
    'select',
    { 'aria-label': 'Filtrar por estado' },
    h('option', { value: '' }, 'Todos los estados'),
    h('option', { value: 'pendiente' }, 'Pendientes'),
    h('option', { value: 'aprobado' }, 'Aprobados'),
    h('option', { value: 'rechazado' }, 'Rechazados'),
    h('option', { value: 'inactivo' }, 'Inactivos'),
  );

  const cargarRecuperaciones = async () => {
    try {
      const { items } = await api.recuperaciones('pendiente');
      if (!items.length) {
        recuperaciones.replaceChildren();
        return;
      }
      recuperaciones.replaceChildren(
        h(
          'div',
          { class: 'tarjeta' },
          h('h3', {}, `Solicitudes de recuperación (${items.length})`),
          h(
            'ul',
            { class: 'lista-limpia' },
            ...items.map((item) =>
              h(
                'li',
                { class: 'fila-dato' },
                h('span', {}, `${item.usuario || item.email} · ${fechaHora(item.creadoEn)}`),
                h(
                  'div',
                  { class: 'acciones-fila' },
                  h(
                    'button',
                    {
                      class: 'btn pequeno',
                      type: 'button',
                      on: {
                        click: async () => {
                          try {
                            const respuesta = await api.atenderRecuperacion(item.id, 'reset');
                            mostrarClaveTemporal(respuesta.passwordTemporal, item.email);
                            cargarRecuperaciones();
                          } catch (error) {
                            toast(error.message, 'error');
                          }
                        },
                      },
                    },
                    'Restablecer',
                  ),
                  h(
                    'button',
                    {
                      class: 'btn secundario pequeno',
                      type: 'button',
                      on: {
                        click: async () => {
                          try {
                            await api.atenderRecuperacion(item.id, 'rechazar');
                            toast('Solicitud rechazada.', 'exito');
                            cargarRecuperaciones();
                          } catch (error) {
                            toast(error.message, 'error');
                          }
                        },
                      },
                    },
                    'Rechazar',
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    } catch {
      recuperaciones.replaceChildren();
    }
  };

  const mostrarClaveTemporal = (clave, email) => {
    const dialogo = modal({
      titulo: 'Contraseña temporal',
      contenido: h(
        'div',
        {},
        h('p', {}, `Entregue esta clave a ${email}. Deberá cambiarla en el primer acceso.`),
        h(
          'div',
          { class: 'aviso info', estilo: { fontSize: '1.15rem', letterSpacing: '.08em', fontWeight: '700' } },
          clave,
        ),
      ),
      pie: [h('button', { class: 'btn', type: 'button', on: { click: () => dialogo.cerrar() } }, 'Entendido')],
    });
  };

  const recargar = async () => {
    lista.replaceChildren(cargando('Cargando usuarios…'));
    try {
      const respuesta = await api.usuarios({
        page: estado.page,
        limit: estado.limit,
        q: estado.q,
        rol: estado.rol,
        estado: estado.estado,
      });
      lista.replaceChildren(
        tabla({
          columnas: [
            {
              titulo: 'Usuario',
              render: (fila) =>
                h(
                  'div',
                  {},
                  h('strong', {}, fila.nombre),
                  h('div', { estilo: { fontSize: '.78rem', color: 'var(--muted)' } }, fila.email),
                ),
            },
            { titulo: 'Rol', render: (fila) => rolEtiqueta(fila.rol) },
            {
              titulo: 'Estado',
              render: (fila) =>
                chip(
                  fila.estado === 'aprobado' ? 'activo' : fila.estado === 'pendiente' ? 'pendiente' : 'rechazado',
                  fila.estado === 'aprobado' ? 'Aprobado' : fila.estado === 'pendiente' ? 'Pendiente' : fila.estado === 'rechazado' ? 'Rechazado' : 'Inactivo',
                ),
            },
            {
              titulo: 'Permisos',
              render: (fila) =>
                h(
                  'div',
                  { estilo: { fontSize: '.76rem', color: 'var(--muted)' } },
                  PERMISOS.map(([clave, texto]) => `${texto}: ${fila.permisos?.[clave] ? 'sí' : 'no'}`).join(' · '),
                ),
            },
            { titulo: 'Último acceso', render: (fila) => (fila.ultimoAcceso ? fechaHora(fila.ultimoAcceso) : '—') },
            {
              titulo: '',
              clase: 'numerico',
              render: (fila) =>
                h(
                  'div',
                  { class: 'acciones' },
                  h(
                    'button',
                    {
                      class: 'icono-btn',
                      type: 'button',
                      title: 'Editar',
                      'aria-label': `Editar ${fila.email}`,
                      html: icono('editar'),
                      on: { click: () => formulario(fila) },
                    },
                  ),
                  fila.estado === 'pendiente'
                    ? h(
                        'button',
                        {
                          class: 'icono-btn',
                          type: 'button',
                          title: 'Aprobar',
                          'aria-label': `Aprobar ${fila.email}`,
                          html: icono('check'),
                          on: { click: () => aprobar(fila) },
                        },
                      )
                    : null,
                  h(
                    'button',
                    {
                      class: 'icono-btn',
                      type: 'button',
                      title: 'Restablecer contraseña',
                      'aria-label': `Restablecer ${fila.email}`,
                      html: icono('candado'),
                      on: { click: () => restablecer(fila) },
                    },
                  ),
                  h(
                    'button',
                    {
                      class: 'icono-btn',
                      type: 'button',
                      title: 'Eliminar',
                      'aria-label': `Eliminar ${fila.email}`,
                      html: icono('borrar'),
                      on: { click: () => eliminar(fila) },
                    },
                  ),
                ),
            },
          ],
          filas: respuesta.items,
          vacio: 'No hay usuarios con esos filtros.',
        }),
      );
      paginador.replaceChildren(
        paginacion({
          page: respuesta.page,
          paginas: respuesta.paginas,
          total: respuesta.total,
          onCambio: (pagina) => {
            estado.page = pagina;
            recargar();
          },
        }),
      );
    } catch (error) {
      lista.replaceChildren(aviso(error.message, 'error'));
    }
  };

  const formulario = (usuario = null) => {
    const nuevo = !usuario;
    const mensaje = h('div');
    const nombre = h('input', { value: usuario?.nombre || '', required: true });
    const email = h('input', { type: 'email', value: usuario?.email || '', required: true });
    const rol = h(
      'select',
      {},
      ...[
        ['admin', 'Administrador'],
        ['determinado', 'Determinado (contratos)'],
        ['sobrecarga', 'Sobrecarga (pagos)'],
      ].map(([valor, etiqueta]) =>
        h('option', { value: valor, selected: (usuario?.rol || 'determinado') === valor }, etiqueta),
      ),
    );
    const estadoUsuario = h(
      'select',
      {},
      ...[
        ['aprobado', 'Aprobado'],
        ['pendiente', 'Pendiente'],
        ['rechazado', 'Rechazado'],
        ['inactivo', 'Inactivo'],
      ].map(([valor, etiqueta]) =>
        h('option', { value: valor, selected: (usuario?.estado || 'aprobado') === valor }, etiqueta),
      ),
    );
    const casillas = Object.fromEntries(
      PERMISOS.map(([clave, texto]) => {
        const casilla = h('input', { type: 'checkbox', checked: usuario?.permisos?.[clave] !== false });
        return [clave, casilla];
      }),
    );
    const permisos = h(
      'div',
      { class: 'permisos' },
      ...PERMISOS.map(([clave, texto]) =>
        h('label', {}, casillas[clave], texto),
      ),
    );

    const dialogo = modal({
      titulo: nuevo ? 'Nuevo usuario' : `Editar ${usuario.email}`,
      contenido: h(
        'form',
        {
          id: 'form-usuario',
          on: {
            submit: async (evento) => {
              evento.preventDefault();
              mensaje.replaceChildren();
              const cuerpo = {
                nombre: nombre.value.trim(),
                rol: rol.value,
                estado: estadoUsuario.value,
                permisos: Object.fromEntries(Object.entries(casillas).map(([clave, casilla]) => [clave, casilla.checked])),
              };
              try {
                if (nuevo) {
                  const respuesta = await api.crearUsuario({ ...cuerpo, email: email.value.trim() });
                  dialogo.cerrar();
                  recargar();
                  if (respuesta.passwordTemporal) mostrarClaveTemporal(respuesta.passwordTemporal, email.value.trim());
                  else toast('Usuario creado.', 'exito');
                } else {
                  await api.actualizarUsuario(usuario.id, cuerpo);
                  toast('Usuario actualizado.', 'exito');
                  dialogo.cerrar();
                  recargar();
                }
              } catch (error) {
                mensaje.replaceChildren(aviso(error.message, 'error'));
              }
            },
          },
        },
        h(
          'div',
          { class: 'fila-campos' },
          h('div', { class: 'campo' }, h('label', {}, 'Nombre *'), nombre),
          h('div', { class: 'campo' }, h('label', {}, 'Correo *'), email, h('span', { class: 'ayuda' }, 'El correo identifica la cuenta y no se puede repetir.')),
        ),
        h(
          'div',
          { class: 'fila-campos' },
          h('div', { class: 'campo' }, h('label', {}, 'Rol'), rol),
          h('div', { class: 'campo' }, h('label', {}, 'Estado'), estadoUsuario),
        ),
        h('div', { class: 'campo' }, h('label', {}, 'Permisos'), permisos),
        nuevo ? h('p', { class: 'ayuda' }, 'Se generará una contraseña temporal que deberá cambiarse al primer acceso.') : null,
        mensaje,
      ),
      pie: [
        h('button', { class: 'btn secundario', type: 'button', on: { click: () => dialogo.cerrar() } }, 'Cancelar'),
        h('button', { class: 'btn', type: 'submit', form: 'form-usuario' }, nuevo ? 'Crear usuario' : 'Guardar cambios'),
      ],
    });
    email.disabled = !nuevo;
  };

  const aprobar = async (usuario) => {
    const aceptar = await confirmar({
      titulo: 'Aprobar usuario',
      mensaje: `¿Habilitar el acceso de ${usuario.email}?`,
      texto: 'Aprobar',
    });
    if (!aceptar) return;
    try {
      await api.aprobarUsuario(usuario.id, true);
      toast('Usuario aprobado.', 'exito');
      recargar();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const restablecer = async (usuario) => {
    const aceptar = await confirmar({
      titulo: 'Restablecer contraseña',
      mensaje: `Se generará una clave temporal para ${usuario.email} y se cerrarán sus sesiones.`,
      texto: 'Restablecer',
      peligro: true,
    });
    if (!aceptar) return;
    try {
      const respuesta = await api.resetUsuario(usuario.id);
      mostrarClaveTemporal(respuesta.passwordTemporal, usuario.email);
      recargar();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const eliminar = async (usuario) => {
    const aceptar = await confirmar({
      titulo: 'Eliminar usuario',
      mensaje: `¿Eliminar la cuenta ${usuario.email}? La acción no se puede deshacer.`,
      texto: 'Eliminar',
      peligro: true,
    });
    if (!aceptar) return;
    try {
      await api.eliminarUsuario(usuario.id);
      toast('Usuario eliminado.', 'exito');
      recargar();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  buscador.addEventListener(
    'input',
    debounce(() => {
      estado.q = buscador.value.trim();
      estado.page = 1;
      recargar();
    }, 350),
  );
  filtroRol.addEventListener('change', () => {
    estado.rol = filtroRol.value;
    estado.page = 1;
    recargar();
  });
  filtroEstado.addEventListener('change', () => {
    estado.estado = filtroEstado.value;
    estado.page = 1;
    recargar();
  });

  raiz.replaceChildren(
    h(
      'div',
      { class: 'rejilla' },
      recuperaciones,
      h(
        'div',
        { class: 'tarjeta' },
        h(
          'div',
          { class: 'barra-herramientas' },
          h('div', { class: 'buscador' }, h('span', { html: icono('buscar') }), buscador),
          filtroRol,
          filtroEstado,
          h(
            'div',
            { class: 'cabecera-acciones' },
            h(
              'button',
              { class: 'btn', type: 'button', on: { click: () => formulario() } },
              h('span', { html: icono('mas'), estilo: { display: 'inline-flex' } }),
              'Nuevo usuario',
            ),
          ),
        ),
      ),
      h('div', { class: 'tarjeta sin-relleno' }, lista),
      paginador,
    ),
  );
  await Promise.all([recargar(), cargarRecuperaciones()]);
}
