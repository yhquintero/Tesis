import { api } from '../api.js';
import {
  aviso,
  cargando,
  fechaHora,
  h,
  icono,
  paginacion,
  tabla,
} from '../ui.js';

export async function renderAuditoria(raiz) {
  const estado = { page: 1, limit: 30, accion: '', desde: '', hasta: '' };
  const lista = h('div');
  const paginador = h('div');

  const accion = h('input', { placeholder: 'Filtrar por acción (login, contrato_creado…)', 'aria-label': 'Acción' });
  const desde = h('input', { type: 'date', 'aria-label': 'Desde' });
  const hasta = h('input', { type: 'date', 'aria-label': 'Hasta' });

  const recargar = async () => {
    lista.replaceChildren(cargando('Consultando auditoría…'));
    try {
      const respuesta = await api.auditoria({
        page: estado.page,
        limit: estado.limit,
        accion: estado.accion,
        desde: estado.desde,
        hasta: estado.hasta,
      });
      lista.replaceChildren(
        tabla({
          columnas: [
            { titulo: 'Fecha', render: (fila) => fechaHora(fila.creadoEn) },
            { titulo: 'Usuario', render: (fila) => fila.usuario || 'sistema' },
            {
              titulo: 'Acción',
              render: (fila) => h('span', { class: 'chip azul' }, fila.accion),
            },
            {
              titulo: 'Entidad',
              render: (fila) =>
                fila.entidad ? `${fila.entidad}${fila.entidadId ? ` #${fila.entidadId}` : ''}` : '—',
            },
            {
              titulo: 'Detalle',
              render: (fila) =>
                h(
                  'span',
                  {
                    estilo: {
                      fontSize: '.76rem',
                      color: 'var(--muted)',
                      display: 'inline-block',
                      maxWidth: '380px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'middle',
                    },
                    title: fila.detalle || '',
                  },
                  fila.detalle || '—',
                ),
            },
            { titulo: 'IP', render: (fila) => fila.ip || '—' },
          ],
          filas: respuesta.items,
          vacio: 'No hay eventos para los filtros seleccionados.',
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

  const aplicar = () => {
    estado.accion = accion.value.trim();
    estado.desde = desde.value;
    estado.hasta = hasta.value;
    estado.page = 1;
    recargar();
  };

  raiz.replaceChildren(
    h(
      'div',
      { class: 'rejilla' },
      h(
        'div',
        { class: 'tarjeta' },
        h(
          'div',
          { class: 'barra-herramientas' },
          h('div', { class: 'buscador' }, h('span', { html: icono('buscar') }), accion),
          desde,
          hasta,
          h('button', { class: 'btn secundario', type: 'button', on: { click: aplicar } }, 'Filtrar'),
        ),
        h(
          'p',
          { class: 'kpi-detalle' },
          'Registro inmutable de acciones críticas: accesos, altas, aprobaciones, cambios de estado, exportaciones y respaldos.',
        ),
      ),
      h('div', { class: 'tarjeta sin-relleno' }, lista),
      paginador,
    ),
  );
  await recargar();
}
