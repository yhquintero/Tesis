import { api } from '../api.js';
import {
  aviso,
  cargando,
  chip,
  confirmar,
  descargar,
  dinero,
  fecha,
  h,
  icono,
  modal,
  numero,
  paginacion,
  tabla,
  toast,
  ETIQUETA_ESTADO,
} from '../ui.js';
import { puede } from '../sesion.js';

const SIGUIENTES = {
  pendiente: ['aprobado', 'anulado'],
  aprobado: ['pagado', 'anulado'],
  pagado: [],
  anulado: [],
};

export async function renderPagos(raiz) {
  const estado = { page: 1, limit: 15, estado: '', periodo: '' };
  const lista = h('div');
  const paginador = h('div');

  const filtroEstado = h(
    'select',
    { 'aria-label': 'Filtrar por estado' },
    h('option', { value: '' }, 'Todos los estados'),
    ...['pendiente', 'aprobado', 'pagado', 'anulado'].map((valor) =>
      h('option', { value: valor }, ETIQUETA_ESTADO[valor]),
    ),
  );
  const filtroPeriodo = h('select', { 'aria-label': 'Filtrar por período' }, h('option', { value: '' }, 'Todos los períodos'));

  const cargarPeriodos = async () => {
    try {
      const { periodos } = await api.periodosPago();
      filtroPeriodo.replaceChildren(
        h('option', { value: '' }, 'Todos los períodos'),
        ...periodos.map((p) => h('option', { value: p }, p)),
      );
    } catch {
      /* sin períodos todavía */
    }
  };

  const recargar = async () => {
    lista.replaceChildren(cargando('Cargando pagos…'));
    try {
      const respuesta = await api.pagos({
        page: estado.page,
        limit: estado.limit,
        estado: estado.estado,
        periodo: estado.periodo,
      });
      lista.replaceChildren(
        tabla({
          columnas: [
            {
              titulo: 'Contrato',
              render: (fila) =>
                h(
                  'button',
                  { class: 'btn plano pequeno', type: 'button', on: { click: () => detalle(fila.id) } },
                  fila.contrato || `#${fila.contratoId}`,
                ),
            },
            { titulo: 'Profesor', clave: 'profesor' },
            { titulo: 'Período', clave: 'periodo' },
            { titulo: 'Horas', clase: 'numerico', render: (fila) => `${numero(fila.horas)} h` },
            { titulo: 'Importe', clase: 'numerico', render: (fila) => dinero(fila.importe) },
            { titulo: 'Estado', render: (fila) => chip(fila.estado) },
            {
              titulo: 'Límite',
              render: (fila) =>
                h(
                  'span',
                  { class: fila.vencido ? 'chip rojo' : '' },
                  fecha(fila.fechaLimite),
                ),
            },
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
                      title: 'Ver detalle',
                      'aria-label': 'Ver pago',
                      html: icono('ojo'),
                      on: { click: () => detalle(fila.id) },
                    },
                  ),
                ),
            },
          ],
          filas: respuesta.items,
          vacio: 'No hay pagos para los filtros seleccionados.',
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

  const detalle = async (id) => {
    try {
      const { pago } = await api.peticion(`/pagos/${id}`);
      const acciones = SIGUIENTES[pago.estado] || [];
      const cuerpo = h(
        'div',
        { class: 'rejilla' },
        h(
          'div',
          { class: 'tarjeta-cabecera', estilo: { marginBottom: 0 } },
          h('h3', { estilo: { margin: 0 } }, `Pago ${pago.periodo}`),
          chip(pago.estado),
        ),
        pago.vencido ? aviso('El pago superó el plazo de 30 días posteriores al fin del contrato.', 'error') : null,
        h(
          'dl',
          { class: 'detalle-grid' },
          ...[
            ['Contrato', pago.contrato],
            ['Profesor', pago.profesor],
            ['Horas', `${numero(pago.horas)} h`],
            ['Tarifa', dinero(pago.tarifa)],
            ['Importe', dinero(pago.importe)],
            ['Fecha límite', fecha(pago.fechaLimite)],
            ['Fecha de pago', pago.fechaPago ? fecha(pago.fechaPago) : '—'],
            ['Observaciones', pago.observaciones || '—'],
          ].map(([etiqueta, valor]) =>
            h('div', { class: 'fila-dato' }, h('dt', {}, etiqueta), h('dd', {}, valor)),
          ),
        ),
        acciones.length
          ? h(
              'div',
              { class: 'acciones-fila' },
              ...acciones.map((siguiente) =>
                h(
                  'button',
                  {
                    class: `btn pequeno${siguiente === 'anulado' ? ' peligro' : ''}`,
                    type: 'button',
                    on: { click: () => cambiar(pago, siguiente, dialogo) },
                  },
                  siguiente === 'aprobado'
                    ? 'Aprobar pago'
                    : siguiente === 'pagado'
                      ? 'Marcar como pagado'
                      : 'Anular pago',
                ),
              ),
            )
          : h('p', { class: 'kpi-detalle' }, 'El pago está cerrado y no admite más cambios.'),
      );
      const dialogo = modal({
        titulo: `Pago de ${pago.contrato}`,
        contenido: cuerpo,
        pie: [h('button', { class: 'btn', type: 'button', on: { click: () => dialogo.cerrar() } }, 'Cerrar')],
      });
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const cambiar = async (pago, siguiente, dialogo) => {
    let forzar = false;
    if (siguiente === 'aprobado' && pago.vencido) {
      forzar = await confirmar({
        titulo: 'Aprobación fuera de plazo',
        mensaje:
          'El pago venció. Como administrador puede aprobarlo dejando constancia en la auditoría. ¿Desea continuar?',
        texto: 'Aprobar de todos modos',
      });
      if (!forzar) return;
    } else {
      const aceptar = await confirmar({
        titulo: 'Cambiar estado del pago',
        mensaje: `El pago pasará a «${ETIQUETA_ESTADO[siguiente]}». ¿Desea continuar?`,
        texto: 'Confirmar',
      });
      if (!aceptar) return;
    }
    try {
      await api.estadoPago(pago.id, siguiente, { forzar });
      toast(`Pago actualizado a ${ETIQUETA_ESTADO[siguiente]}.`, 'exito');
      dialogo.cerrar();
      recargar();
    } catch (error) {
      toast(error.message, 'error', 6000);
    }
  };

  const nuevoPago = async () => {
    let contratos = [];
    try {
      contratos = (await api.contratosDisponibles()).contratos;
    } catch (error) {
      toast(error.message, 'error');
      return;
    }
    if (!contratos.length) {
      toast('No hay contratos activos o completados que puedan generar pagos.', 'error', 6000);
      return;
    }
    const mensaje = h('div');
    const selContrato = h(
      'select',
      { required: true },
      ...contratos.map((c) =>
        h('option', { value: c.id }, `${c.codigo} · ${c.profesor} · ${numero(c.horas)} h`),
      ),
    );
    const periodo = h('input', {
      value: contratos[0]?.codigo ? new Date().toISOString().slice(0, 7) : '',
      placeholder: 'AAAA-MM',
    });
    const horas = h('input', { type: 'number', min: '0.5', step: '0.5', value: contratos[0]?.horas ?? '' });
    const observaciones = h('textarea', { rows: 2 });
    const importe = h('strong', {}, '—');

    const actualizar = () => {
      const contrato = contratos.find((c) => String(c.id) === String(selContrato.value));
      if (!contrato) return;
      importe.textContent = dinero((Number(horas.value) || 0) * contrato.tarifa_hora);
    };
    selContrato.addEventListener('change', () => {
      const contrato = contratos.find((c) => String(c.id) === String(selContrato.value));
      if (contrato) horas.value = contrato.horas;
      actualizar();
    });
    horas.addEventListener('input', actualizar);

    const dialogo = modal({
      titulo: 'Registrar pago',
      contenido: h(
        'form',
        {
          id: 'form-pago',
          on: {
            submit: async (evento) => {
              evento.preventDefault();
              mensaje.replaceChildren();
              try {
                await api.crearPago({
                  contratoId: Number(selContrato.value),
                  periodo: periodo.value.trim(),
                  horas: Number(horas.value),
                  observaciones: observaciones.value.trim(),
                });
                toast('Pago registrado en estado pendiente.', 'exito');
                dialogo.cerrar();
                recargar();
              } catch (error) {
                mensaje.replaceChildren(aviso(error.message, 'error'));
              }
            },
          },
        },
        h('div', { class: 'campo' }, h('label', {}, 'Contrato *'), selContrato),
        h(
          'div',
          { class: 'fila-campos' },
          h('div', { class: 'campo' }, h('label', {}, 'Período *'), periodo),
          h('div', { class: 'campo' }, h('label', {}, 'Horas *'), horas),
        ),
        h(
          'div',
          { class: 'campo' },
          h('label', {}, 'Importe calculado'),
          h('div', { class: 'kpi-valor', estilo: { fontSize: '1.3rem' } }, importe),
          h('span', { class: 'ayuda' }, 'Se calcula con la tarifa del contrato y queda sujeto al plazo de 30 días.'),
        ),
        h('div', { class: 'campo' }, h('label', {}, 'Observaciones'), observaciones),
        mensaje,
      ),
      pie: [
        h('button', { class: 'btn secundario', type: 'button', on: { click: () => dialogo.cerrar() } }, 'Cancelar'),
        h('button', { class: 'btn', type: 'submit', form: 'form-pago' }, 'Registrar pago'),
      ],
    });
    actualizar();
  };

  filtroEstado.addEventListener('change', () => {
    estado.estado = filtroEstado.value;
    estado.page = 1;
    recargar();
  });
  filtroPeriodo.addEventListener('change', () => {
    estado.periodo = filtroPeriodo.value;
    estado.page = 1;
    recargar();
  });

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
          filtroEstado,
          filtroPeriodo,
          h(
            'div',
            { class: 'cabecera-acciones' },
            h(
              'button',
              {
                class: 'btn secundario',
                type: 'button',
                on: {
                  click: () =>
                    descargar(
                      `/pagos/export.xlsx?${new URLSearchParams({ estado: estado.estado, periodo: estado.periodo })}`,
                      'pagos.xlsx',
                    ),
                },
              },
              h('span', { html: icono('excel'), estilo: { display: 'inline-flex' } }),
              'Excel',
            ),
            h(
              'button',
              {
                class: 'btn secundario',
                type: 'button',
                on: {
                  click: () =>
                    descargar(
                      `/pagos/pdf?${new URLSearchParams({ estado: estado.estado, periodo: estado.periodo })}`,
                      'pagos.pdf',
                    ),
                },
              },
              h('span', { html: icono('pdf'), estilo: { display: 'inline-flex' } }),
              'PDF',
            ),
            puede('pagos', 'crear')
              ? h(
                  'button',
                  { class: 'btn', type: 'button', on: { click: nuevoPago } },
                  h('span', { html: icono('mas'), estilo: { display: 'inline-flex' } }),
                  'Registrar pago',
                )
              : null,
          ),
        ),
      ),
      h('div', { class: 'tarjeta sin-relleno' }, lista),
      paginador,
    ),
  );
  await cargarPeriodos();
  await recargar();
}
