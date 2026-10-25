import { api } from '../api.js';
import {
  aviso,
  cargando,
  confirmar,
  descargar,
  dinero,
  h,
  icono,
  modal,
  numero,
  toast,
} from '../ui.js';
import { esAdmin, puede } from '../sesion.js';

export async function renderPrenomina(raiz, contexto = {}) {
  raiz.replaceChildren(cargando('Calculando la prenómina…'));
  let periodos = [];
  let tarifas = [];
  try {
    const [respuestaPeriodos, respuestaTarifas] = await Promise.all([api.periodos(), api.tarifas()]);
    periodos = respuestaPeriodos.items;
    tarifas = respuestaTarifas.tarifas;
  } catch (error) {
    raiz.replaceChildren(aviso(error.message, 'error'));
    return;
  }
  if (!periodos.length) {
    raiz.replaceChildren(
      aviso('No hay períodos configurados. Un administrador debe crear uno en Configuración.', 'info'),
    );
    return;
  }
  const seleccionado = contexto.consulta?.get('periodo');
  let periodoId = Number(seleccionado) || periodos.find((p) => p.estado === 'abierto')?.id || periodos[0].id;
  const sucios = new Set();
  const contenedor = h('div', { class: 'rejilla' });
  raiz.replaceChildren(contenedor);

  const tarifaDe = (categoria, tipo) =>
    tarifas
      .filter((t) => t.categoriaDocente === categoria && t.tipo === tipo)
      .sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))[0]?.importe ?? 0;

  const dibujar = async () => {
    contenedor.replaceChildren(cargando('Calculando horas y pagos…'));
    sucios.clear();
    let datos;
    try {
      datos = await api.prenomina(periodoId);
    } catch (error) {
      contenedor.replaceChildren(aviso(error.message, 'error'));
      return;
    }
    const { periodo, profesores, resumenCategorias, totales } = datos;
    const editable = puede('prenomina', 'actualizar') && periodo.estado === 'abierto';
    const botonGuardar = h(
      'button',
      { class: 'btn', type: 'button', disabled: true },
      h('span', { html: icono('check'), estilo: { display: 'inline-flex' } }),
      'Guardar cambios',
    );

    const selector = h(
      'select',
      { 'aria-label': 'Período de prenómina' },
      ...periodos.map((p) =>
        h('option', { value: p.id, selected: p.id === periodo.id }, `${p.nombre} · ${p.estado}`),
      ),
    );
    selector.addEventListener('change', () => {
      periodoId = Number(selector.value);
      dibujar();
    });

    const filas = profesores.map((profesor, indice) => {
      const entradas = profesor.horas.map((valor, corte) =>
        h('input', {
          type: 'number',
          min: '0',
          max: '200',
          step: '1',
          value: String(valor),
          'aria-label': `Horas del corte ${corte + 1} para ${profesor.nombre}`,
          dataset: { corte: String(corte) },
          disabled: !editable,
        }),
      );
      const thp = h('td', { class: 'numerico' }, numero(profesor.thp));
      const hsp = h('td', { class: 'numerico' }, numero(profesor.hsp));
      const tpp = h('td', { class: 'numerico' }, dinero(profesor.tpp));
      const fila = h(
        'tr',
        { dataset: { profesor: String(profesor.profesorId) } },
        h('td', {}, String(indice + 1)),
        h(
          'th',
          { scope: 'row' },
          h('div', {}, profesor.nombre),
          h(
            'div',
            { estilo: { fontSize: '.72rem', color: 'var(--muted)', fontWeight: '400' } },
            `${profesor.categoriaPoc} · carga ${numero(profesor.cargaHoraria)} h`,
          ),
        ),
        h('td', {}, profesor.categoriaDocente),
        ...entradas.map((entrada) => h('td', {}, entrada)),
        thp,
        hsp,
        tpp,
      );

      const recalcular = () => {
        const horas = entradas.map((entrada) => Number(entrada.value) || 0);
        const thpValor = horas.reduce((s, x) => s + x, 0);
        const hspValor = horas.reduce((s, x) => s + Math.max(0, x - profesor.cargaHoraria), 0);
        const tppValor =
          (thpValor - hspValor) * tarifaDe(profesor.categoriaDocente, 'determinado') +
          hspValor * tarifaDe(profesor.categoriaDocente, 'sobrecarga');
        thp.textContent = numero(thpValor);
        hsp.textContent = numero(hspValor);
        tpp.textContent = dinero(tppValor);
        return { thpValor, hspValor, tppValor };
      };

      for (const entrada of entradas) {
        entrada.addEventListener('input', () => {
          sucios.add(profesor.profesorId);
          fila.dataset.sucio = '1';
          recalcular();
          botonGuardar.disabled = sucios.size === 0;
          botonGuardar.textContent = `Guardar ${sucios.size} cambio(s)`;
          actualizarTotales();
        });
      }
      return { fila, profesor, entradas, recalcular };
    });

    const pieThp = h('td', { class: 'numerico' }, numero(totales.thp));
    const pieHsp = h('td', { class: 'numerico' }, numero(totales.hsp));
    const pieTpp = h('td', { class: 'numerico' }, dinero(totales.tpp));
    const pieHoras = Array.from({ length: periodo.cortes }, () => h('td', { class: 'numerico' }));

    const actualizarTotales = () => {
      let thp = 0;
      let hsp = 0;
      let tpp = 0;
      const porCorte = new Array(periodo.cortes).fill(0);
      for (const item of filas) {
        const valores = item.recalcular();
        thp += valores.thpValor;
        hsp += valores.hspValor;
        tpp += valores.tppValor;
        item.entradas.forEach((entrada, i) => {
          porCorte[i] += Number(entrada.value) || 0;
        });
      }
      pieThp.textContent = numero(thp);
      pieHsp.textContent = numero(hsp);
      pieTpp.textContent = dinero(tpp);
      pieHoras.forEach((celda, i) => {
        celda.textContent = numero(porCorte[i]);
      });
    };
    actualizarTotales();

    botonGuardar.addEventListener('click', async () => {
      const pendientes = [...sucios];
      if (!pendientes.length) return;
      botonGuardar.disabled = true;
      botonGuardar.textContent = 'Guardando…';
      let guardados = 0;
      try {
        for (const profesorId of pendientes) {
          const item = filas.find((f) => f.profesor.profesorId === profesorId);
          const horas = item.entradas.map((entrada) => Number(entrada.value) || 0);
          await api.guardarHoras(periodo.id, profesorId, horas);
          guardados += 1;
        }
        toast(`Se guardaron ${guardados} profesor(es).`, 'exito');
        dibujar();
      } catch (error) {
        toast(`Se guardaron ${guardados} de ${pendientes.length}. ${error.message}`, 'error', 7000);
        botonGuardar.disabled = false;
        botonGuardar.textContent = 'Reintentar guardado';
      }
    });

    const cuerpoTabla = h(
      'table',
      { class: 'tabla' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { scope: 'col' }, 'No.'),
          h('th', { scope: 'col' }, 'Profesor'),
          h('th', { scope: 'col' }, 'Categoría docente'),
          ...Array.from({ length: periodo.cortes }, (_, i) =>
            h('th', { scope: 'col', class: 'numerico' }, String(i + 1)),
          ),
          h('th', { scope: 'col', class: 'numerico' }, 'THP'),
          h('th', { scope: 'col', class: 'numerico' }, 'HSP'),
          h('th', { scope: 'col', class: 'numerico' }, 'TPP'),
        ),
      ),
      h('tbody', {}, ...filas.map((item) => item.fila)),
      h(
        'tfoot',
        {},
        h(
          'tr',
          {},
          h('td', { colspan: '3' }, 'TOTAL'),
          ...pieHoras,
          pieThp,
          pieHsp,
          pieTpp,
        ),
      ),
    );

    const resumen = h(
      'table',
      { class: 'tabla' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { scope: 'col' }, 'Categoría'),
          h('th', { scope: 'col', class: 'numerico' }, 'THP'),
          h('th', { scope: 'col', class: 'numerico' }, 'HSP'),
          h('th', { scope: 'col', class: 'numerico' }, 'TPP'),
        ),
      ),
      h(
        'tbody',
        {},
        ...resumenCategorias.map((fila) =>
          h(
            'tr',
            {},
            h('td', {}, fila.categoriaDocente),
            h('td', { class: 'numerico' }, numero(fila.thp)),
            h('td', { class: 'numerico' }, numero(fila.hsp)),
            h('td', { class: 'numerico' }, dinero(fila.tpp)),
          ),
        ),
      ),
      h(
        'tfoot',
        {},
        h(
          'tr',
          {},
          h('td', {}, 'TOTAL'),
          h('td', { class: 'numerico' }, numero(totales.thp)),
          h('td', { class: 'numerico' }, numero(totales.hsp)),
          h('td', { class: 'numerico' }, dinero(totales.tpp)),
        ),
      ),
    );

    const acciones = h(
      'div',
      { class: 'cabecera-acciones' },
      h(
        'button',
        {
          class: 'btn secundario',
          type: 'button',
          on: { click: () => descargar(`/prenomina/export.xlsx?periodoId=${periodo.id}`, `prenomina-${periodo.nombre}.xlsx`) },
        },
        h('span', { html: icono('excel'), estilo: { display: 'inline-flex' } }),
        'Exportar Excel',
      ),
      puede('contratos', 'crear')
        ? h(
            'button',
            {
              class: 'btn secundario',
              type: 'button',
              on: {
                click: async () => {
                  const aceptar = await confirmar({
                    titulo: 'Generar contratos desde la prenómina',
                    mensaje:
                      'Se crearán contratos en borrador por cada profesor con horas: la parte base como contrato determinado y el exceso como sobrecarga. Los que ya tengan contrato en el período se omiten.',
                    texto: 'Generar borradores',
                  });
                  if (!aceptar) return;
                  try {
                    const resultado = await api.generarContratos(periodo.id);
                    toast(`Se generaron ${resultado.creados} contrato(s) en borrador.`, 'exito', 6000);
                  } catch (error) {
                    toast(error.message, 'error', 6000);
                  }
                },
              },
            },
            'Generar contratos',
          )
        : null,
      esAdmin()
        ? h(
            'button',
            {
              class: 'btn secundario',
              type: 'button',
              on: {
                click: async () => {
                  const cerrar = periodo.estado === 'abierto';
                  const aceptar = await confirmar({
                    titulo: cerrar ? 'Cerrar período' : 'Reabrir período',
                    mensaje: cerrar
                      ? 'Al cerrar el período no se podrán editar las horas hasta reabrirlo.'
                      : 'El período volverá a admitir cambios en las horas.',
                    texto: cerrar ? 'Cerrar' : 'Reabrir',
                    peligro: cerrar,
                  });
                  if (!aceptar) return;
                  try {
                    await api.cambiarPeriodo(periodo.id, cerrar ? 'cerrado' : 'abierto');
                    toast('Período actualizado.', 'exito');
                    const actualizados = await api.periodos();
                    periodos = actualizados.items;
                    dibujar();
                  } catch (error) {
                    toast(error.message, 'error');
                  }
                },
              },
            },
            periodo.estado === 'abierto' ? 'Cerrar período' : 'Reabrir período',
          )
        : null,
      esAdmin()
        ? h(
            'button',
            {
              class: 'btn',
              type: 'button',
              on: { click: () => nuevoPeriodo(() => dibujar()) },
            },
            h('span', { html: icono('mas'), estilo: { display: 'inline-flex' } }),
            'Nuevo período',
          )
        : null,
    );

    contenedor.replaceChildren(
      h(
        'div',
        { class: 'tarjeta' },
        h(
          'div',
          { class: 'tarjeta-cabecera' },
          h(
            'div',
            {},
            h('h2', { estilo: { margin: 0 } }, `Prenómina ${periodo.nombre}`),
            h(
              'span',
              { class: 'kpi-detalle' },
              `${profesores.length} profesores · ${periodo.cortes} cortes · ${periodo.estado === 'abierto' ? 'editable' : 'cerrado'}`,
            ),
          ),
          h('div', { class: 'acciones-fila' }, selector, botonGuardar),
        ),
        editable
          ? h('p', { class: 'kpi-detalle' }, 'Edite las horas por corte y pulse «Guardar cambios». El THP, HSP y TPP se recalculan al guardar.')
          : h('p', { class: 'kpi-detalle' }, 'Vista de solo lectura. El período está cerrado o su rol no permite editar.'),
        acciones,
      ),
      h('div', { class: 'tarjeta sin-relleno' }, h('div', { class: 'grilla-prenomina' }, cuerpoTabla)),
      h(
        'div',
        { class: 'tarjeta' },
        h('h3', {}, 'Resumen por categoría docente'),
        h('div', { class: 'tabla-envoltura' }, resumen),
        h(
          'p',
          { class: 'kpi-detalle', estilo: { marginTop: '10px' } },
          `THP: total de horas del profesor · HSP: horas de sobrecarga (por encima de la carga base) · TPP: total a pagar. ` +
            `Tarifas vigentes al ${periodo.inicio || 'día de hoy'}.`,
        ),
      ),
    );
  };

  await dibujar();
}

function nuevoPeriodo(alCrear) {
  const mensaje = h('div');
  const nombre = h('input', { placeholder: '2027-1', required: true });
  const inicio = h('input', { type: 'date', required: true });
  const fin = h('input', { type: 'date', required: true });
  const cortes = h('input', { type: 'number', min: '1', max: '26', value: '14' });
  const dialogo = modal({
    titulo: 'Nuevo período académico',
    contenido: h(
      'form',
      {
        id: 'form-periodo',
        on: {
          submit: async (evento) => {
            evento.preventDefault();
            try {
              await api.crearPeriodo({
                nombre: nombre.value.trim(),
                inicio: inicio.value,
                fin: fin.value,
                cortes: Number(cortes.value),
              });
              toast('Período creado.', 'exito');
              dialogo.cerrar();
              if (alCrear) alCrear();
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
        h('div', { class: 'campo' }, h('label', {}, 'Cortes *'), cortes),
      ),
      h(
        'div',
        { class: 'fila-campos' },
        h('div', { class: 'campo' }, h('label', {}, 'Inicio *'), inicio),
        h('div', { class: 'campo' }, h('label', {}, 'Fin *'), fin),
      ),
      mensaje,
    ),
    pie: [
      h('button', { class: 'btn secundario', type: 'button', on: { click: () => dialogo.cerrar() } }, 'Cancelar'),
      h('button', { class: 'btn', type: 'submit', form: 'form-periodo' }, 'Crear período'),
    ],
  });
}
