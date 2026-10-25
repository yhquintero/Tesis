import { api } from '../api.js';
import {
  aviso,
  cargando,
  confirmar,
  descargar,
  dinero,
  fechaHora,
  h,
  icono,
  modal,
  toast,
} from '../ui.js';

export async function renderConfiguracion(raiz) {
  raiz.replaceChildren(cargando('Cargando configuración…'));
  let configuracion;
  let tarifas;
  let respaldos;
  try {
    const [respuestaConfig, respuestaTarifas, respuestaRespaldos] = await Promise.all([
      api.configuracion(),
      api.tarifas(),
      api.respaldos(),
    ]);
    configuracion = respuestaConfig.configuracion;
    tarifas = respuestaTarifas.tarifas;
    respaldos = respuestaRespaldos.respaldos;
  } catch (error) {
    raiz.replaceChildren(aviso(error.message, 'error'));
    return;
  }

  const mensajeGeneral = h('div');
  const campos = {
    nombre_institucion: h('input', { value: configuracion.nombre_institucion }),
    facultad: h('input', { value: configuracion.facultad }),
    departamento: h('input', { value: configuracion.departamento }),
    moneda: h('input', { value: configuracion.moneda }),
    simbolo_moneda: h('input', { value: configuracion.simbolo_moneda, maxlength: '3' }),
    dias_pago: h('input', { type: 'number', min: '1', max: '120', value: configuracion.dias_pago }),
    meses_max_contrato: h('input', { type: 'number', min: '1', max: '24', value: configuracion.meses_max_contrato }),
    max_intentos: h('input', { type: 'number', min: '1', max: '20', value: configuracion.max_intentos }),
    minutos_bloqueo: h('input', { type: 'number', min: '1', max: '240', value: configuracion.minutos_bloqueo }),
    hora_respaldo: h('input', { type: 'time', value: configuracion.hora_respaldo }),
    correo_soporte: h('input', { type: 'email', value: configuracion.correo_soporte }),
    telefono_soporte: h('input', { value: configuracion.telefono_soporte }),
    direccion: h('input', { value: configuracion.direccion }),
    respaldo_automatico: h('input', { type: 'checkbox', checked: configuracion.respaldo_automatico === '1' }),
  };

  const campoHtml = (etiqueta, control, ayuda = '') =>
    h('div', { class: 'campo' }, h('label', {}, etiqueta), control, ayuda ? h('span', { class: 'ayuda' }, ayuda) : null);

  const formularioGeneral = h(
    'form',
    {
      on: {
        submit: async (evento) => {
          evento.preventDefault();
          mensajeGeneral.replaceChildren();
          const cambios = {
            nombre_institucion: campos.nombre_institucion.value.trim(),
            facultad: campos.facultad.value.trim(),
            departamento: campos.departamento.value.trim(),
            moneda: campos.moneda.value.trim(),
            simbolo_moneda: campos.simbolo_moneda.value.trim(),
            dias_pago: campos.dias_pago.value,
            meses_max_contrato: campos.meses_max_contrato.value,
            max_intentos: campos.max_intentos.value,
            minutos_bloqueo: campos.minutos_bloqueo.value,
            hora_respaldo: campos.hora_respaldo.value,
            correo_soporte: campos.correo_soporte.value.trim(),
            telefono_soporte: campos.telefono_soporte.value.trim(),
            direccion: campos.direccion.value.trim(),
            respaldo_automatico: campos.respaldo_automatico.checked ? '1' : '0',
          };
          try {
            await api.guardarConfiguracion(cambios);
            toast('Configuración guardada.', 'exito');
          } catch (error) {
            mensajeGeneral.replaceChildren(aviso(error.message, 'error'));
          }
        },
      },
    },
    h(
      'div',
      { class: 'fila-campos' },
      campoHtml('Nombre de la institución', campos.nombre_institucion),
      campoHtml('Facultad', campos.facultad),
    ),
    h(
      'div',
      { class: 'fila-campos' },
      campoHtml('Departamento', campos.departamento),
      campoHtml('Dirección', campos.direccion),
    ),
    h(
      'div',
      { class: 'fila-campos' },
      campoHtml('Moneda', campos.moneda, 'Código ISO o denominación (CUP, USD…).'),
      campoHtml('Símbolo', campos.simbolo_moneda),
    ),
    h(
      'div',
      { class: 'fila-campos' },
      campoHtml('Días para pagar', campos.dias_pago, 'Plazo posterior al fin del contrato (regla RN7).'),
      campoHtml('Meses máximos de contrato', campos.meses_max_contrato, 'Regla RN6: por defecto 12.'),
    ),
    h(
      'div',
      { class: 'fila-campos' },
      campoHtml('Intentos de acceso', campos.max_intentos),
      campoHtml('Minutos de bloqueo', campos.minutos_bloqueo),
    ),
    h(
      'div',
      { class: 'fila-campos' },
      campoHtml('Hora del respaldo automático', campos.hora_respaldo),
      campoHtml('Correo de soporte', campos.correo_soporte),
    ),
    h(
      'div',
      { class: 'fila-campos' },
      campoHtml('Teléfono de soporte', campos.telefono_soporte),
      h(
        'label',
        { class: 'interruptor', estilo: { marginTop: '22px' } },
        h('span', {}, 'Respaldo automático diario'),
        campos.respaldo_automatico,
      ),
    ),
    mensajeGeneral,
    h(
      'div',
      { class: 'acciones-fila', estilo: { marginTop: '8px' } },
      h('button', { class: 'btn', type: 'submit' }, 'Guardar configuración'),
    ),
  );

  /* -------------------------------- Tarifas -------------------------------- */

  const categorias = [...new Set(tarifas.map((t) => t.categoriaDocente))];
  const matriz = {};
  for (const categoria of categorias) {
    matriz[categoria] = {};
    for (const tipo of ['determinado', 'sobrecarga']) {
      const fila = tarifas
        .filter((t) => t.categoriaDocente === categoria && t.tipo === tipo)
        .sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))[0];
      matriz[categoria][tipo] = fila?.importe ?? '';
    }
  }
  const entradasTarifa = {};
  const mensajeTarifas = h('div');
  const filasTarifa = categorias.map((categoria) => {
    entradasTarifa[categoria] = {};
    return h(
      'tr',
      {},
      h('td', {}, categoria),
      ...['determinado', 'sobrecarga'].map((tipo) => {
        const entrada = h('input', {
          type: 'number',
          min: '0',
          step: '0.01',
          value: String(matriz[categoria][tipo] ?? ''),
          'aria-label': `Tarifa ${tipo} de ${categoria}`,
          estilo: { width: '110px', padding: '6px 8px' },
        });
        entradasTarifa[categoria][tipo] = entrada;
        return h('td', { class: 'numerico' }, entrada);
      }),
    );
  });

  const guardarTarifas = async () => {
    mensajeTarifas.replaceChildren();
    const hoy = new Date().toISOString().slice(0, 10);
    try {
      for (const categoria of categorias) {
        for (const tipo of ['determinado', 'sobrecarga']) {
          const valor = Number(entradasTarifa[categoria][tipo].value);
          if (!(valor > 0)) continue;
          if (valor === Number(matriz[categoria][tipo])) continue;
          await api.guardarTarifa({
            categoriaDocente: categoria,
            tipo,
            importe: valor,
            vigenteDesde: hoy,
          });
        }
      }
      toast('Tarifas actualizadas. Rigen desde hoy.', 'exito');
      const actualizadas = await api.tarifas();
      tarifas = actualizadas.tarifas;
    } catch (error) {
      mensajeTarifas.replaceChildren(aviso(error.message, 'error'));
    }
  };

  /* -------------------------------- Respaldos -------------------------------- */

  const listaRespaldos = h('div');
  const pintarRespaldos = (items) => {
    if (!items.length) {
      listaRespaldos.replaceChildren(h('p', { class: 'kpi-detalle' }, 'Todavía no hay respaldos.'));
      return;
    }
    listaRespaldos.replaceChildren(
      h(
        'div',
        { class: 'tabla-envoltura' },
        h(
          'table',
          { class: 'tabla' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', {}, 'Archivo'),
              h('th', {}, 'Fecha'),
              h('th', { class: 'numerico' }, 'Tamaño'),
              h('th', {}, ''),
            ),
          ),
          h(
            'tbody',
            {},
            ...items.map((item) =>
              h(
                'tr',
                {},
                h('td', { estilo: { fontFamily: 'monospace', fontSize: '.78rem' } }, item.archivo),
                h('td', {}, fechaHora(item.creadoEn)),
                h('td', { class: 'numerico' }, `${(item.bytes / 1024).toFixed(1)} KB`),
                h(
                  'td',
                  { class: 'numerico' },
                  h(
                    'div',
                    { class: 'acciones' },
                    h(
                      'button',
                      {
                        class: 'icono-btn',
                        type: 'button',
                        title: 'Descargar',
                        'aria-label': 'Descargar respaldo',
                        html: icono('descargar'),
                        on: { click: () => descargar(`/respaldos/${item.id}/descargar`, item.archivo) },
                      },
                    ),
                    h(
                      'button',
                      {
                        class: 'icono-btn',
                        type: 'button',
                        title: 'Restaurar',
                        'aria-label': 'Restaurar respaldo',
                        html: icono('sincronizar'),
                        on: {
                          click: async () => {
                            const aceptar = await confirmar({
                              titulo: 'Restaurar respaldo',
                              mensaje:
                                'Se reemplazará la base de datos actual por este respaldo. Se cerrarán las sesiones y deberá iniciar sesión de nuevo.',
                              texto: 'Restaurar',
                              peligro: true,
                            });
                            if (!aceptar) return;
                            try {
                              await api.restaurarRespaldo(item.id);
                              toast('Respaldo restaurado. Inicie sesión nuevamente.', 'exito', 6000);
                              setTimeout(() => window.location.reload(), 1500);
                            } catch (error) {
                              toast(error.message, 'error', 6000);
                            }
                          },
                        },
                      },
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  };
  pintarRespaldos(respaldos);

  const crearRespaldo = async () => {
    try {
      await api.crearRespaldo();
      toast('Respaldo creado.', 'exito');
      respaldos = (await api.respaldos()).respaldos;
      pintarRespaldos(respaldos);
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  raiz.replaceChildren(
    h(
      'div',
      { class: 'rejilla' },
      h(
        'div',
        { class: 'tarjeta' },
        h('h2', {}, 'Parámetros del sistema'),
        h(
          'p',
          { class: 'kpi-detalle' },
          'Estos valores alimentan las validaciones del servidor, los contratos y los reportes.',
        ),
        formularioGeneral,
      ),
      h(
        'div',
        { class: 'tarjeta' },
        h('h2', {}, 'Tarifas por categoría docente'),
        h(
          'p',
          { class: 'kpi-detalle' },
          'Importe por hora según la Resolución 210/2023. Al cambiar una tarifa se registra una nueva vigencia desde hoy; los contratos ya creados conservan su tarifa.',
        ),
        h(
          'div',
          { class: 'tabla-envoltura' },
          h(
            'table',
            { class: 'tabla' },
            h(
              'thead',
              {},
              h(
                'tr',
                {},
                h('th', {}, 'Categoría'),
                h('th', { class: 'numerico' }, 'Determinado ($/h)'),
                h('th', { class: 'numerico' }, 'Sobrecarga ($/h)'),
              ),
            ),
            h('tbody', {}, ...filasTarifa),
          ),
        ),
        mensajeTarifas,
        h(
          'div',
          { class: 'acciones-fila', estilo: { marginTop: '10px' } },
          h('button', { class: 'btn', type: 'button', on: { click: guardarTarifas } }, 'Guardar tarifas'),
        ),
      ),
      h(
        'div',
        { class: 'tarjeta' },
        h(
          'div',
          { class: 'tarjeta-cabecera' },
          h('h2', { estilo: { margin: 0 } }, 'Respaldos de la base de datos'),
          h(
            'button',
            { class: 'btn secundario', type: 'button', on: { click: crearRespaldo } },
            h('span', { html: icono('carpeta'), estilo: { display: 'inline-flex' } }),
            'Crear respaldo ahora',
          ),
        ),
        h(
          'p',
          { class: 'kpi-detalle' },
          'Se conservan 30 días. El respaldo automático se ejecuta una vez al día si está habilitado.',
        ),
        listaRespaldos,
      ),
      h(
        'div',
        { class: 'tarjeta' },
        h('h2', {}, 'Auditoría'),
        h(
          'p',
          { class: 'kpi-detalle' },
          'Consulte quién creó, aprobó o modificó contratos, pagos y usuarios.',
        ),
        h('a', { class: 'btn secundario', href: '#/auditoria' }, 'Ver registro de auditoría'),
      ),
    ),
  );
}
