import { api } from '../api.js';
import {
  aviso,
  cargando,
  chip,
  dinero,
  fecha,
  h,
  icono,
  rolEtiqueta,
  tabla,
} from '../ui.js';
import { barrasHorizontales, color, donut } from '../charts.js';

export async function renderPanel(raiz, contexto = {}) {
  raiz.replaceChildren(cargando('Cargando panel de control…'));
  let datos;
  try {
    datos = await api.dashboard();
  } catch (error) {
    raiz.replaceChildren(aviso(error.message, 'error'));
    return;
  }

  const kpis = datos.kpis;
  const tarjetas = [
    {
      icono: 'grupos',
      titulo: 'Profesores activos',
      valor: kpis.profesoresActivos,
      detalle: `de ${kpis.profesores} registrados`,
    },
    {
      icono: 'contratos',
      titulo: 'Contratos activos',
      valor: kpis.contratosActivos,
      detalle: `${kpis.contratosTotal} en total`,
    },
    {
      icono: 'pagos',
      titulo: 'Pagos pendientes',
      valor: kpis.pagosPendientes,
      detalle: dinero(kpis.importePendiente),
    },
    {
      icono: 'alerta',
      titulo: 'Pagos vencidos',
      valor: kpis.pagosVencidos,
      detalle: dinero(kpis.importeVencido),
    },
    {
      icono: 'prenomina',
      titulo: 'Horas del período',
      valor: Number(kpis.horasPeriodo || 0).toLocaleString('es-CU'),
      detalle: datos.periodo ? `Período ${datos.periodo.nombre}` : 'Sin período activo',
    },
    {
      icono: 'dinero',
      titulo: 'Importe del período',
      valor: dinero(kpis.importePeriodo),
      detalle: 'Prenómina calculada',
    },
  ];

  const seccionKpis = h(
    'div',
    { class: 'kpis' },
    ...tarjetas.map((item) =>
      h(
        'article',
        { class: 'kpi' },
        h('span', { class: 'kpi-icono', html: icono(item.icono) }),
        h('span', { class: 'kpi-titulo' }, item.titulo),
        h('span', { class: 'kpi-valor' }, String(item.valor)),
        h('span', { class: 'kpi-detalle' }, item.detalle),
      ),
    ),
  );

  const usuarios = datos.usuariosPorRol || [];
  const estados = (datos.estados || []).map((fila) => ({
    etiqueta: fila.estado,
    valor: fila.cantidad,
    color: fila.estado === 'Aprobado' ? '#2E7D32' : '#C9A227',
  }));
  const contratosEstado = (datos.contratosPorEstado || []).map((fila, i) => ({
    etiqueta: fila.estado,
    valor: fila.cantidad,
    color: color(i),
  }));
  const horasCategoria = (datos.horasPorCategoria || []).map((fila, i) => ({
    etiqueta: fila.categoria,
    valor: Number(fila.horas || 0),
    color: color(i),
  }));
  const pagosSobrecarga = (datos.pagoPorSobrecarga || []).map((fila, i) => ({
    etiqueta: fila.categoria,
    valor: Number(fila.importe || 0),
    color: color(i),
  }));

  const lienzoUsuarios = h('canvas', { role: 'img' });
  const lienzoEstados = h('canvas', { role: 'img' });
  const lienzoHoras = h('canvas', { role: 'img' });
  const lienzoPagos = h('canvas', { role: 'img' });

  const contenido = h(
    'div',
    { class: 'rejilla' },
    h(
      'div',
      { class: 'tarjeta', estilo: { background: 'linear-gradient(120deg,#1B5E20,#2E7D32)', color: '#fff' } },
      h(
        'div',
        { class: 'tarjeta-cabecera', estilo: { marginBottom: 0 } },
        h(
          'div',
          {},
          h('h2', { estilo: { color: '#fff', marginBottom: '2px' } }, `Hola, ${contexto.usuario?.nombre || 'bienvenido'}`),
          h(
            'p',
            { estilo: { margin: 0, color: 'rgba(255,255,255,.82)', fontSize: '.86rem' } },
            datos.periodo
              ? `Período ${datos.periodo.nombre} · ${datos.periodo.estado === 'abierto' ? 'abierto para edición' : 'cerrado'}`
              : 'No hay períodos configurados',
          ),
        ),
        h('a', { class: 'btn oro pequeno', href: '#/prenomina' }, 'Ir a la prenómina'),
      ),
    ),
    kpis.pagosVencidos > 0
      ? aviso(
          `Hay ${kpis.pagosVencidos} pago(s) fuera del plazo de 30 días por ${dinero(kpis.importeVencido)}. Revíselos en la sección de pagos.`,
          'error',
        )
      : null,
    seccionKpis,
    h(
      'div',
      { class: 'dos-columnas' },
      h(
        'div',
        { class: 'tarjeta' },
        h('h3', {}, 'Contratos por estado'),
        h('div', { class: 'grafico' }, lienzoEstados),
      ),
      h(
        'div',
        { class: 'tarjeta' },
        h('h3', {}, 'Usuarios por rol'),
        h('div', { class: 'grafico' }, lienzoUsuarios),
        h(
          'div',
          { class: 'leyenda' },
          ...usuarios.map((fila, i) =>
            h('span', {}, h('i', { estilo: { background: color(i) } }), `${rolEtiqueta(fila.rol)}: ${fila.cantidad}`),
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'dos-columnas' },
      h(
        'div',
        { class: 'tarjeta' },
        h('h3', {}, 'Horas por categoría docente'),
        h('div', { class: 'grafico' }, lienzoHoras),
      ),
      h(
        'div',
        { class: 'tarjeta' },
        h('h3', {}, 'Pago por sobrecarga'),
        h('div', { class: 'grafico' }, lienzoPagos),
        h(
          'div',
          { class: 'leyenda' },
          ...pagosSobrecarga.map((fila) =>
            h('span', {}, h('i', { estilo: { background: fila.color } }), `${fila.etiqueta}: ${dinero(fila.valor)}`),
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'tarjeta' },
      h(
        'div',
        { class: 'tarjeta-cabecera' },
        h('h3', { estilo: { margin: 0 } }, 'Contratos recientes'),
        h('a', { class: 'btn secundario pequeno', href: '#/contratos' }, 'Ver todos'),
      ),
      tabla({
        columnas: [
          {
            titulo: 'Código',
            render: (fila) => h('a', { href: `#/contratos?ver=${fila.id}` }, fila.codigo),
          },
          { titulo: 'Profesor', clave: 'profesor' },
          {
            titulo: 'Tipo',
            render: (fila) =>
              chip(fila.tipo === 'sobrecarga' ? 'activo' : 'aprobado',
                fila.tipo === 'sobrecarga' ? 'Sobrecarga' : 'Determinado'),
          },
          { titulo: 'Estado', render: (fila) => chip(fila.estado) },
          { titulo: 'Importe', clase: 'numerico', render: (fila) => dinero(fila.importe) },
          { titulo: 'Vence', render: (fila) => fecha(fila.fecha_fin) },
        ],
        filas: datos.contratosRecientes || [],
        vacio: 'Todavía no hay contratos registrados.',
      }),
    ),
    h(
      'div',
      { class: 'tarjeta' },
      h(
        'div',
        { class: 'tarjeta-cabecera' },
        h('h3', { estilo: { margin: 0 } }, 'Pagos por atender'),
        h('a', { class: 'btn secundario pequeno', href: '#/pagos' }, 'Gestionar pagos'),
      ),
      tabla({
        columnas: [
          { titulo: 'Contrato', clave: 'codigo' },
          { titulo: 'Profesor', clave: 'profesor' },
          { titulo: 'Período', clave: 'periodo' },
          { titulo: 'Importe', clase: 'numerico', render: (fila) => dinero(fila.importe) },
          { titulo: 'Límite', render: (fila) => fecha(fila.fecha_limite) },
        ],
        filas: datos.pagosPendientes || [],
        vacio: 'No hay pagos pendientes.',
      }),
    ),
  );

  raiz.replaceChildren(contenido);
  if (estados.length) donut(lienzoUsuarios, estados, { centro: String(estados.reduce((s, x) => s + x.valor, 0)) });
  if (contratosEstado.length) barrasHorizontales(lienzoEstados, contratosEstado, { alto: 240 });
  if (horasCategoria.length) barrasHorizontales(lienzoHoras, horasCategoria, { alto: 260, sufijo: ' h' });
  if (pagosSobrecarga.length) barrasHorizontales(lienzoPagos, pagosSobrecarga, { alto: 260 });
}
