import { api } from '../api.js';
import {
  aviso,
  cargando,
  chip,
  confirmar,
  debounce,
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
import { esAdmin, puede } from '../sesion.js';

const TRANSICIONES = {
  borrador: ['pendiente', 'cancelado'],
  pendiente: ['aprobado', 'rechazado', 'cancelado'],
  aprobado: ['activo', 'cancelado'],
  activo: ['completado', 'cancelado'],
  rechazado: ['borrador'],
  completado: [],
  cancelado: [],
};

const ETIQUETA_ACCION = {
  pendiente: 'Enviar a aprobación',
  aprobado: 'Aprobar contrato',
  rechazado: 'Rechazar contrato',
  activo: 'Marcar como activo',
  completado: 'Marcar como completado',
  cancelado: 'Cancelar contrato',
  borrador: 'Devolver a borrador',
};

export async function renderContratos(raiz, contexto = {}) {
  const estado = { page: 1, limit: 15, q: '', estado: '', tipo: '' };
  const lista = h('div');
  const paginador = h('div');
  let tarifas = [];

  try {
    tarifas = (await api.tarifas()).tarifas;
  } catch {
    tarifas = [];
  }

  const buscador = h('input', {
    type: 'search',
    placeholder: 'Buscar por código, objeto o profesor',
    'aria-label': 'Buscar contratos',
  });
  const filtroEstado = h(
    'select',
    { 'aria-label': 'Filtrar por estado' },
    h('option', { value: '' }, 'Todos los estados'),
    ...(contexto.catalogos?.estadosContrato || Object.keys(ETIQUETA_ESTADO)).map((valor) =>
      h('option', { value: valor }, ETIQUETA_ESTADO[valor] || valor),
    ),
  );
  const filtroTipo = h(
    'select',
    { 'aria-label': 'Filtrar por tipo' },
    h('option', { value: '' }, 'Todos los tipos'),
    h('option', { value: 'determinado' }, 'Determinado'),
    h('option', { value: 'sobrecarga' }, 'Sobrecarga'),
  );

  const recargar = async () => {
    lista.replaceChildren(cargando('Cargando contratos…'));
    try {
      const respuesta = await api.contratos({
        page: estado.page,
        limit: estado.limit,
        q: estado.q,
        estado: estado.estado,
        tipo: estado.tipo,
      });
      lista.replaceChildren(
        tabla({
          columnas: [
            {
              titulo: 'Código',
              render: (fila) =>
                h(
                  'button',
                  {
                    class: 'btn plano pequeno',
                    type: 'button',
                    on: { click: () => detalle(fila.id) },
                  },
                  fila.codigo,
                ),
            },
            {
              titulo: 'Profesor',
              render: (fila) =>
                h(
                  'div',
                  {},
                  h('strong', {}, fila.profesor || '—'),
                  h(
                    'div',
                    { estilo: { fontSize: '.75rem', color: 'var(--muted)' } },
                    fila.categoriaDocente || '',
                  ),
                ),
            },
            {
              titulo: 'Tipo',
              render: (fila) =>
                chip(
                  fila.tipo === 'sobrecarga' ? 'activo' : 'azul',
                  fila.tipo === 'sobrecarga' ? 'Sobrecarga' : 'Determinado',
                ),
            },
            {
              titulo: 'Vigencia',
              render: (fila) =>
                h(
                  'div',
                  { estilo: { fontSize: '.8rem' } },
                  `${fecha(fila.fechaInicio)} — ${fecha(fila.fechaFin)}`,
                  fila.vencido
                    ? h('div', { class: 'chip rojo', estilo: { marginTop: '3px' } }, 'Vencido')
                    : null,
                ),
            },
            { titulo: 'Horas', clase: 'numerico', render: (fila) => `${numero(fila.horas)} h` },
            { titulo: 'Importe', clase: 'numerico', render: (fila) => dinero(fila.importe) },
            { titulo: 'Estado', render: (fila) => chip(fila.estado) },
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
                      'aria-label': `Ver ${fila.codigo}`,
                      html: icono('ojo'),
                      on: { click: () => detalle(fila.id) },
                    },
                  ),
                  h(
                    'button',
                    {
                      class: 'icono-btn',
                      type: 'button',
                      title: 'Exportar PDF',
                      'aria-label': `PDF de ${fila.codigo}`,
                      html: icono('pdf'),
                      on: { click: () => descargar(`/contratos/${fila.id}/pdf`, `${fila.codigo}.pdf`) },
                    },
                  ),
                ),
            },
          ],
          filas: respuesta.items,
          vacio: 'Cree el primer contrato con el botón «Nuevo contrato».',
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
      const { contrato } = await api.contrato(id);
      const botonesEstado = (TRANSICIONES[contrato.estado] || []).filter((siguiente) => {
        if (['aprobado', 'rechazado', 'cancelado'].includes(siguiente)) return esAdmin();
        return puede('contratos', 'actualizar');
      });

      const cuerpo = h(
        'div',
        { class: 'rejilla' },
        h(
          'div',
          { class: 'tarjeta-cabecera', estilo: { marginBottom: 0 } },
          h(
            'div',
            {},
            h('h3', { estilo: { margin: 0 } }, contrato.tipo === 'sobrecarga' ? 'Contrato por sobrecarga' : 'Contrato determinado'),
            h('span', { class: 'kpi-detalle' }, `Código ${contrato.codigo}`),
          ),
          chip(contrato.estado),
        ),
        contrato.motivoRechazo
          ? aviso(`Motivo del rechazo: ${contrato.motivoRechazo}`, 'error')
          : null,
        h(
          'dl',
          { class: 'detalle-grid' },
          ...[
            ['Profesor', contrato.profesor],
            ['No. trabajador', contrato.noTrabajador],
            ['Categoría docente', contrato.categoriaDocente],
            ['Período', contrato.periodo || '—'],
            ['Vigencia', `${fecha(contrato.fechaInicio)} — ${fecha(contrato.fechaFin)}`],
            ['Horas', `${numero(contrato.horas)} h`],
            ['Tarifa por hora', dinero(contrato.tarifaHora)],
            ['Importe', dinero(contrato.importe)],
            ['Objeto', contrato.objeto],
            ['Observaciones', contrato.observaciones || '—'],
          ].map(([etiqueta, valor]) => h('div', { class: 'fila-dato' }, h('dt', {}, etiqueta), h('dd', {}, valor))),
        ),
        contrato.clausulas?.length
          ? h(
              'div',
              {},
              h('h4', {}, 'Cláusulas'),
              h('ol', { class: 'clausulas' }, ...contrato.clausulas.map((texto) => h('li', {}, texto))),
            )
          : null,
        h(
          'div',
          {},
          h('h4', {}, 'Pagos del contrato'),
          tabla({
            columnas: [
              { titulo: 'Período', clave: 'periodo' },
              { titulo: 'Horas', clase: 'numerico', render: (f) => `${numero(f.horas)} h` },
              { titulo: 'Importe', clase: 'numerico', render: (f) => dinero(f.importe) },
              { titulo: 'Estado', render: (f) => chip(f.estado) },
              { titulo: 'Límite', render: (f) => fecha(f.fechaLimite) },
            ],
            filas: contrato.pagos || [],
            vacio: 'Sin pagos registrados.',
          }),
        ),
        botonesEstado.length
          ? h(
              'div',
              { class: 'acciones-fila' },
              ...botonesEstado.map((siguiente) =>
                h(
                  'button',
                  {
                    class: `btn${siguiente === 'cancelado' || siguiente === 'rechazado' ? ' peligro' : ''} pequeno`,
                    type: 'button',
                    on: { click: () => cambiarEstado(contrato, siguiente, dialogo) },
                  },
                  ETIQUETA_ACCION[siguiente] || siguiente,
                ),
              ),
              puede('contratos', 'actualizar') && ['borrador', 'rechazado'].includes(contrato.estado)
                ? h(
                    'button',
                    {
                      class: 'btn secundario pequeno',
                      type: 'button',
                      on: {
                        click: () => {
                          dialogo.cerrar();
                          formulario(contrato);
                        },
                      },
                    },
                    'Editar',
                  )
                : null,
              contrato.estado === 'borrador' && esAdmin()
                ? h(
                    'button',
                    {
                      class: 'btn secundario pequeno',
                      type: 'button',
                      on: {
                        click: async () => {
                          const aceptar = await confirmar({
                            titulo: 'Eliminar contrato',
                            mensaje: `¿Eliminar definitivamente ${contrato.codigo}?`,
                            texto: 'Eliminar',
                            peligro: true,
                          });
                          if (!aceptar) return;
                          try {
                            await api.eliminarContrato(contrato.id);
                            toast('Contrato eliminado.', 'exito');
                            dialogo.cerrar();
                            recargar();
                          } catch (error) {
                            toast(error.message, 'error', 6000);
                          }
                        },
                      },
                    },
                    'Eliminar',
                  )
                : null,
            )
          : null,
      );

      const dialogo = modal({
        titulo: contrato.codigo,
        contenido: cuerpo,
        ancho: true,
        pie: [
          h(
            'button',
            {
              class: 'btn secundario',
              type: 'button',
              on: { click: () => descargar(`/contratos/${contrato.id}/pdf`, `${contrato.codigo}.pdf`) },
            },
            h('span', { html: icono('pdf'), estilo: { display: 'inline-flex' } }),
            'Exportar PDF',
          ),
          h('button', { class: 'btn', type: 'button', on: { click: () => dialogo.cerrar() } }, 'Cerrar'),
        ],
      });
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const cambiarEstado = async (contrato, nuevoEstado, dialogo) => {
    let motivo = '';
    if (nuevoEstado === 'rechazado') {
      motivo = await pedirMotivo();
      if (motivo === null) return;
    } else {
      const aceptar = await confirmar({
        titulo: ETIQUETA_ACCION[nuevoEstado] || 'Cambiar estado',
        mensaje: `El contrato ${contrato.codigo} pasará a «${ETIQUETA_ESTADO[nuevoEstado]}». ¿Desea continuar?`,
        texto: 'Confirmar',
      });
      if (!aceptar) return;
    }
    try {
      await api.estadoContrato(contrato.id, nuevoEstado, motivo);
      toast(`Contrato actualizado a ${ETIQUETA_ESTADO[nuevoEstado]}.`, 'exito');
      dialogo?.cerrar();
      recargar();
    } catch (error) {
      toast(error.message, 'error', 6000);
    }
  };

  const pedirMotivo = () =>
    new Promise((resolver) => {
      const area = h('textarea', { rows: 3, placeholder: 'Explique el motivo del rechazo' });
      let cerrado = false;
      const dialogo = modal({
        titulo: 'Rechazar contrato',
        contenido: h('div', { class: 'campo' }, h('label', {}, 'Motivo del rechazo *'), area),
        pie: [
          h(
            'button',
            { class: 'btn secundario', type: 'button', on: { click: () => dialogo.cerrar() } },
            'Cancelar',
          ),
          h(
            'button',
            {
              class: 'btn peligro',
              type: 'button',
              on: {
                click: () => {
                  const texto = area.value.trim();
                  if (!texto) {
                    area.focus();
                    return;
                  }
                  cerrado = true;
                  dialogo.cerrar();
                  resolver(texto);
                },
              },
            },
            'Rechazar',
          ),
        ],
        alCerrar: () => {
          if (!cerrado) resolver(null);
        },
      });
    });

  const formulario = async (contrato = null) => {
    const nuevo = !contrato;
    let profesores = [];
    try {
      const respuesta = await api.profesores({ limit: 200, activo: 'true' });
      profesores = respuesta.items;
    } catch (error) {
      toast(error.message, 'error');
      return;
    }
    const mensaje = h('div');
    const hoy = new Date();
    const finPorDefecto = new Date(hoy.getTime() + 90 * 86400000).toISOString().slice(0, 10);

    const selProfesor = h(
      'select',
      { required: true },
      h('option', { value: '' }, 'Seleccione un profesor…'),
      ...profesores.map((p) =>
        h(
          'option',
          { value: p.id, selected: contrato?.profesorId === p.id },
          `${p.nombre} · ${p.categoriaDocente}`,
        ),
      ),
    );
    const selTipo = h(
      'select',
      { required: true },
      ...[
        ['determinado', 'Contrato determinado'],
        ['sobrecarga', 'Pago por sobrecarga'],
      ].map(([valor, etiqueta]) =>
        h(
          'option',
          { value: valor, selected: (contrato?.tipo || 'determinado') === valor },
          etiqueta,
        ),
      ),
    );
    const objeto = h('textarea', { rows: 2, required: true }, contrato?.objeto || '');
    const periodo = h('input', { value: contrato?.periodo || '', placeholder: '2026-2' });
    const inicio = h('input', { type: 'date', value: contrato?.fechaInicio || hoy.toISOString().slice(0, 10) });
    const fin = h('input', { type: 'date', value: contrato?.fechaFin || finPorDefecto });
    const horas = h('input', { type: 'number', min: '1', step: '0.5', value: contrato?.horas ?? '' });
    const observaciones = h('textarea', { rows: 2 }, contrato?.observaciones || '');
    const clausulas = h('textarea', {
      rows: 3,
      placeholder: 'Una cláusula por línea (opcional)',
    });
    clausulas.value = (contrato?.clausulas || []).join('\n');

    const infoTarifa = h('div', { class: 'aviso info', estilo: { marginBottom: 0 } }, 'Seleccione profesor y tipo para ver la tarifa.');
    const infoImporte = h('strong', {}, '—');

    const actualizarCalculo = () => {
      const profesor = profesores.find((p) => String(p.id) === String(selProfesor.value));
      if (!profesor) return;
      const tarifa = tarifas
        .filter((t) => t.categoriaDocente === profesor.categoriaDocente && t.tipo === selTipo.value)
        .sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))[0];
      if (!tarifa) {
        infoTarifa.textContent = `No hay tarifa configurada para ${profesor.categoriaDocente} (${selTipo.value}).`;
        infoTarifa.className = 'aviso error';
        return;
      }
      infoTarifa.className = 'aviso info';
      infoTarifa.textContent = `Tarifa vigente para ${profesor.categoriaDocente}: ${dinero(tarifa.importe)} por hora.`;
      const total = (Number(horas.value) || 0) * tarifa.importe;
      infoImporte.textContent = dinero(total);
    };
    selProfesor.addEventListener('change', actualizarCalculo);
    selTipo.addEventListener('change', actualizarCalculo);
    horas.addEventListener('input', actualizarCalculo);

    const campoHtml = (etiqueta, control, ayuda = '') =>
      h('div', { class: 'campo' }, h('label', {}, etiqueta), control, ayuda ? h('span', { class: 'ayuda' }, ayuda) : null);

    const dialogo = modal({
      titulo: nuevo ? 'Nuevo contrato' : `Editar ${contrato.codigo}`,
      ancho: true,
      contenido: h(
        'form',
        {
          id: 'form-contrato',
          novalidate: true,
          on: {
            submit: async (evento) => {
              evento.preventDefault();
              mensaje.replaceChildren();
              const cuerpo = {
                profesorId: Number(selProfesor.value),
                tipo: selTipo.value,
                objeto: objeto.value.trim(),
                periodo: periodo.value.trim(),
                fechaInicio: inicio.value,
                fechaFin: fin.value,
                horas: Number(horas.value),
                observaciones: observaciones.value.trim(),
                clausulas: clausulas.value
                  .split('\n')
                  .map((linea) => linea.trim())
                  .filter(Boolean),
              };
              if (!cuerpo.profesorId) {
                mensaje.append(aviso('Seleccione un profesor.', 'error'));
                return;
              }
              if (!cuerpo.objeto) {
                mensaje.append(aviso('Escriba el objeto del contrato.', 'error'));
                return;
              }
              if (!(cuerpo.horas > 0)) {
                mensaje.append(aviso('Las horas deben ser mayores que cero.', 'error'));
                return;
              }
              try {
                if (nuevo) await api.crearContrato(cuerpo);
                else await api.actualizarContrato(contrato.id, cuerpo);
                toast(nuevo ? 'Contrato creado en borrador.' : 'Contrato actualizado.', 'exito');
                dialogo.cerrar();
                recargar();
              } catch (error) {
                mensaje.replaceChildren(aviso(error.message, 'error'));
              }
            },
          },
        },
        h(
          'div',
          { class: 'fila-campos' },
          campoHtml('Profesor *', selProfesor),
          campoHtml('Tipo de contrato *', selTipo),
        ),
        campoHtml('Objeto del contrato *', objeto),
        h(
          'div',
          { class: 'fila-campos' },
          campoHtml('Período', periodo),
          campoHtml('Horas *', horas),
        ),
        h(
          'div',
          { class: 'fila-campos' },
          campoHtml('Fecha de inicio *', inicio),
          campoHtml('Fecha de fin *', fin, 'La duración no puede exceder 12 meses.'),
        ),
        h('div', { class: 'fila-campos' }, infoTarifa, h('div', { class: 'campo' }, h('label', {}, 'Importe estimado'), h('div', { class: 'kpi-valor', estilo: { fontSize: '1.25rem' } }, infoImporte))),
        campoHtml('Cláusulas adicionales', clausulas, 'Si las deja vacías se generan las cláusulas legales por defecto.'),
        campoHtml('Observaciones', observaciones),
        mensaje,
      ),
      pie: [
        h('button', { class: 'btn secundario', type: 'button', on: { click: () => dialogo.cerrar() } }, 'Cancelar'),
        h('button', { class: 'btn', type: 'submit', form: 'form-contrato' }, nuevo ? 'Crear contrato' : 'Guardar cambios'),
      ],
    });
    actualizarCalculo();
  };

  buscador.addEventListener(
    'input',
    debounce(() => {
      estado.q = buscador.value.trim();
      estado.page = 1;
      recargar();
    }, 350),
  );
  filtroEstado.addEventListener('change', () => {
    estado.estado = filtroEstado.value;
    estado.page = 1;
    recargar();
  });
  filtroTipo.addEventListener('change', () => {
    estado.tipo = filtroTipo.value;
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
          h('div', { class: 'buscador' }, h('span', { html: icono('buscar') }), buscador),
          filtroEstado,
          filtroTipo,
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
                      `/contratos/pdf?${new URLSearchParams({ estado: estado.estado, tipo: estado.tipo })}`,
                      'contratos.pdf',
                    ),
                },
              },
              h('span', { html: icono('pdf'), estilo: { display: 'inline-flex' } }),
              'Exportar PDF',
            ),
            puede('contratos', 'crear')
              ? h(
                  'button',
                  { class: 'btn', type: 'button', on: { click: () => formulario() } },
                  h('span', { html: icono('mas'), estilo: { display: 'inline-flex' } }),
                  'Nuevo contrato',
                )
              : null,
          ),
        ),
      ),
      h('div', { class: 'tarjeta sin-relleno' }, lista),
      paginador,
    ),
  );
  await recargar();

  if (contexto.consulta?.get('ver')) {
    detalle(Number(contexto.consulta.get('ver')));
  }
}
