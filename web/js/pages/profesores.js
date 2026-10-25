import { api } from '../api.js';
import {
  aviso,
  cargando,
  chip,
  confirmar,
  debounce,
  descargar,
  h,
  icono,
  modal,
  numero,
  paginacion,
  tabla,
  toast,
} from '../ui.js';
import { catalogos, puede } from '../sesion.js';

export async function renderProfesores(raiz) {
  const estado = { page: 1, limit: 20, q: '', categoria: '', activo: '' };
  const lista = h('div');
  const contador = h('span', { class: 'kpi-detalle' });
  const paginador = h('div');

  const buscador = h('input', {
    type: 'search',
    placeholder: 'Buscar por nombre, CI, número de trabajador o correo',
    'aria-label': 'Buscar profesores',
  });
  const selectCategoria = h(
    'select',
    { 'aria-label': 'Filtrar por categoría docente' },
    h('option', { value: '' }, 'Todas las categorías'),
    ...(catalogos().categoriasDocentes || []).map((c) => h('option', { value: c }, c)),
  );
  const selectActivo = h(
    'select',
    { 'aria-label': 'Filtrar por estado' },
    h('option', { value: '' }, 'Todos'),
    h('option', { value: 'true' }, 'Activos'),
    h('option', { value: 'false' }, 'Inactivos'),
  );

  const recargar = async () => {
    lista.replaceChildren(cargando('Cargando profesores…'));
    try {
      const respuesta = await api.profesores({
        page: estado.page,
        limit: estado.limit,
        q: estado.q,
        categoria: estado.categoria,
        activo: estado.activo,
      });
      contador.textContent = `${respuesta.total} profesor(es) registrados`;
      lista.replaceChildren(
        tabla({
          columnas: [
            {
              titulo: 'No.',
              render: (fila) => String((estado.page - 1) * estado.limit + respuesta.items.indexOf(fila) + 1),
            },
            {
              titulo: 'Profesor',
              render: (fila) =>
                h(
                  'div',
                  {},
                  h('strong', {}, fila.nombre),
                  h(
                    'div',
                    { estilo: { fontSize: '.78rem', color: 'var(--muted)' } },
                    fila.correo || 'Sin correo',
                  ),
                ),
            },
            { titulo: 'No. trabajador', clave: 'noTrabajador' },
            { titulo: 'CI', clave: 'ci' },
            {
              titulo: 'Categoría',
              render: (fila) =>
                h(
                  'div',
                  {},
                  h('span', { class: 'chip verde' }, fila.categoriaDocente),
                  h(
                    'div',
                    { estilo: { fontSize: '.74rem', color: 'var(--muted)', marginTop: '2px' } },
                    fila.categoriaPoc,
                  ),
                ),
            },
            { titulo: 'Carga', clase: 'numerico', render: (fila) => `${numero(fila.cargaHoraria)} h` },
            {
              titulo: 'Estado',
              render: (fila) =>
                chip(fila.activo ? 'activo' : 'cancelado', fila.activo ? 'Activo' : 'Inactivo'),
            },
            {
              titulo: '',
              clase: 'numerico',
              render: (fila) =>
                h(
                  'div',
                  { class: 'acciones' },
                  puede('profesores', 'actualizar')
                    ? h(
                        'button',
                        {
                          class: 'icono-btn',
                          type: 'button',
                          'aria-label': `Editar ${fila.nombre}`,
                          title: 'Editar',
                          html: icono('editar'),
                          on: { click: () => formulario(fila) },
                        },
                      )
                    : null,
                  puede('profesores', 'eliminar')
                    ? h(
                        'button',
                        {
                          class: 'icono-btn',
                          type: 'button',
                          'aria-label': `Eliminar ${fila.nombre}`,
                          title: 'Eliminar',
                          html: icono('borrar'),
                          on: { click: () => eliminar(fila) },
                        },
                      )
                    : null,
                ),
            },
          ],
          filas: respuesta.items,
          vacio: 'Pruebe con otro término de búsqueda o registre un profesor nuevo.',
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

  const formulario = (profesor = null) => {
    const nuevo = !profesor;
    const mensaje = h('div');
    const campos = {
      nombre: h('input', { value: profesor?.nombre || '', required: true }),
      noTrabajador: h('input', { value: profesor?.noTrabajador || '', required: true }),
      ci: h('input', { value: profesor?.ci || '', required: true, inputMode: 'numeric' }),
      anio: h('input', { value: profesor?.anio || '', placeholder: '2do Año' }),
      area: h('input', { value: profesor?.area || 'Facultad de Ciencias Técnicas' }),
      areaCiencia: h('input', { value: profesor?.areaCiencia || 'Ingeniería en Informática' }),
      categoriaPoc: h(
        'select',
        {},
        ...(catalogos().categoriasPoc || ['Profesor', 'Cuadros']).map((valor) =>
          h('option', { value: valor, selected: (profesor?.categoriaPoc || 'Profesor') === valor }, valor),
        ),
      ),
      categoriaDocente: h(
        'select',
        {},
        ...(catalogos().categoriasDocentes || []).map((valor) =>
          h('option', { value: valor, selected: (profesor?.categoriaDocente || 'Instructor') === valor }, valor),
        ),
      ),
      cargaHoraria: h('input', {
        type: 'number',
        step: '0.5',
        min: '0',
        max: '60',
        value: profesor?.cargaHoraria ?? 8,
      }),
      correo: h('input', { type: 'email', value: profesor?.correo || '' }),
      telefono: h('input', { value: profesor?.telefono || '' }),
      activo: h('input', { type: 'checkbox', checked: profesor ? profesor.activo : true }),
    };

    const campoHtml = (etiqueta, control, ayuda = '') =>
      h(
        'div',
        { class: 'campo' },
        h('label', {}, etiqueta),
        control,
        ayuda ? h('span', { class: 'ayuda' }, ayuda) : null,
      );

    const dialogo = modal({
      titulo: nuevo ? 'Nuevo profesor' : `Editar ${profesor.nombre}`,
      contenido: h(
        'form',
        {
          id: 'form-profesor',
          novalidate: true,
          on: {
            submit: async (evento) => {
              evento.preventDefault();
              mensaje.replaceChildren();
              const cuerpo = {
                nombre: campos.nombre.value.trim(),
                noTrabajador: campos.noTrabajador.value.trim(),
                ci: campos.ci.value.trim(),
                anio: campos.anio.value.trim(),
                area: campos.area.value.trim(),
                areaCiencia: campos.areaCiencia.value.trim(),
                categoriaPoc: campos.categoriaPoc.value,
                categoriaDocente: campos.categoriaDocente.value,
                cargaHoraria: Number(campos.cargaHoraria.value || 0),
                correo: campos.correo.value.trim(),
                telefono: campos.telefono.value.trim(),
                activo: campos.activo.checked,
              };
              try {
                if (nuevo) await api.crearProfesor(cuerpo);
                else await api.actualizarProfesor(profesor.id, cuerpo);
                toast(nuevo ? 'Profesor registrado.' : 'Profesor actualizado.', 'exito');
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
          campoHtml('Nombre y apellidos *', campos.nombre),
          campoHtml('No. trabajador *', campos.noTrabajador),
        ),
        h(
          'div',
          { class: 'fila-campos' },
          campoHtml('Carné de identidad *', campos.ci),
          campoHtml('Año académico', campos.anio),
        ),
        h(
          'div',
          { class: 'fila-campos' },
          campoHtml('Categoría docente *', campos.categoriaDocente),
          campoHtml('Categoría PoC', campos.categoriaPoc),
        ),
        h(
          'div',
          { class: 'fila-campos' },
          campoHtml('Carga horaria por corte', campos.cargaHoraria, 'Horas base que se descuentan antes de la sobrecarga.'),
          campoHtml('Correo electrónico', campos.correo),
        ),
        h(
          'div',
          { class: 'fila-campos' },
          campoHtml('Área', campos.area),
          campoHtml('Área de la ciencia', campos.areaCiencia),
        ),
        h(
          'div',
          { class: 'fila-campos' },
          campoHtml('Teléfono', campos.telefono),
          h(
            'label',
            { class: 'interruptor', estilo: { borderTop: '0', marginTop: '22px' } },
            h('span', {}, 'Profesor activo'),
            campos.activo,
          ),
        ),
        mensaje,
      ),
      pie: [
        h('button', { class: 'btn secundario', type: 'button', on: { click: () => dialogo.cerrar() } }, 'Cancelar'),
        h('button', { class: 'btn', type: 'submit', form: 'form-profesor' }, nuevo ? 'Registrar' : 'Guardar cambios'),
      ],
      alCerrar: () => {},
    });
  };

  const eliminar = async (profesor) => {
    const aceptar = await confirmar({
      titulo: 'Eliminar profesor',
      mensaje: `¿Eliminar a ${profesor.nombre}? Solo es posible si no tiene contratos asociados.`,
      texto: 'Eliminar',
      peligro: true,
    });
    if (!aceptar) return;
    try {
      await api.eliminarProfesor(profesor.id);
      toast('Profesor eliminado.', 'exito');
      recargar();
    } catch (error) {
      toast(error.message, 'error', 6000);
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
  selectCategoria.addEventListener('change', () => {
    estado.categoria = selectCategoria.value;
    estado.page = 1;
    recargar();
  });
  selectActivo.addEventListener('change', () => {
    estado.activo = selectActivo.value;
    estado.page = 1;
    recargar();
  });

  const acciones = h(
    'div',
    { class: 'cabecera-acciones' },
    h(
      'button',
      {
        class: 'btn secundario',
        type: 'button',
        on: { click: () => descargar('/profesores/export.xlsx', 'profesores.xlsx') },
      },
      h('span', { html: icono('excel'), estilo: { display: 'inline-flex' } }),
      'Exportar Excel',
    ),
    puede('profesores', 'crear')
      ? h(
          'button',
          { class: 'btn', type: 'button', on: { click: () => formulario() } },
          h('span', { html: icono('mas'), estilo: { display: 'inline-flex' } }),
          'Nuevo profesor',
        )
      : null,
  );

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
          selectCategoria,
          selectActivo,
          acciones,
        ),
        contador,
      ),
      h('div', { class: 'tarjeta sin-relleno' }, lista),
      paginador,
    ),
  );
  await recargar();
}
