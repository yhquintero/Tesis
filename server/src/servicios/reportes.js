import { DocumentoPDF } from '../lib/pdf.js';
import { construirXlsx } from '../lib/xlsx.js';
import { moneda } from './util.js';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function fechaLarga(iso) {
  if (!iso) return '';
  const [anio, mes, dia] = iso.split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

function fechaCorta(iso) {
  if (!iso) return '';
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

const dinero = (valor, simbolo = '$') =>
  `${simbolo}${moneda(valor).toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function sello() {
  return new Date().toLocaleString('es-CU', { dateStyle: 'long', timeStyle: 'short' });
}

/* ------------------------------------------------------------------ */
/* Contratos                                                           */
/* ------------------------------------------------------------------ */

function dibujarContrato(doc, contrato, cfg, conEncabezado = true) {
  if (conEncabezado) doc.encabezadoInstitucional('Contratos docentes');
  else doc.nuevaPagina();

  doc.cursor -= 6;
  doc.texto(
    contrato.tipo === 'determinado'
      ? 'CONTRATO DE TRABAJO DETERMINADO'
      : 'CONTRATO POR SOBRECARGA DOCENTE',
    { tamano: 15, negrita: true, color: [0.106, 0.369, 0.125], interlineado: 20 },
  );
  doc.texto(`Código ${contrato.codigo} · ${contrato.etiquetaEstado}`, {
    tamano: 9,
    color: [0.38, 0.43, 0.39],
    interlineado: 13,
  });
  doc.salto(8);
  doc.linea(doc.margen ?? 52, doc.cursor, 595.28 - 52, doc.cursor, { grosor: 0.8 });
  doc.salto(14);

  const anio = contrato.fechaInicio.slice(0, 4);
  doc.parrafo(
    `En Pinar del Río, a los ${Number(contrato.fechaInicio.slice(8, 10))} días del mes de ` +
      `${MESES[Number(contrato.fechaInicio.slice(5, 7)) - 1]} de ${anio}, comparecen por una parte la ` +
      `${cfg.nombre_institucion}, ${cfg.facultad}, ${cfg.departamento}, representada en este acto por su ` +
      `Jefe de Departamento, y por la otra el(la) profesor(a) ${contrato.profesor}, con carné de identidad ` +
      `${contrato.ci || '—'}, número de trabajador ${contrato.noTrabajador || '—'}, categoría docente ` +
      `${contrato.categoriaDocente || '—'}.`,
    { tamano: 9.4, interlineado: 13.4 },
  );
  doc.parrafo(
    'Ambas partes, reconociéndose mutuamente la capacidad legal necesaria para formalizar el presente ' +
      'contrato, convienen en suscribirlo de conformidad con las siguientes cláusulas:',
    { tamano: 9.4, interlineado: 13.4, espacioDespues: 10 },
  );

  doc.texto('DATOS DEL CONTRATO', {
    tamano: 9,
    negrita: true,
    color: [0.106, 0.369, 0.125],
    interlineado: 13,
  });
  doc.salto(4);
  doc.tabla({
    columnas: ['Concepto', 'Detalle'],
    filas: [
      ['Objeto', contrato.objeto],
      ['Período', contrato.periodo || '—'],
      ['Vigencia', `${fechaLarga(contrato.fechaInicio)} — ${fechaLarga(contrato.fechaFin)}`],
      ['Horas contratadas', `${contrato.horas} h`],
      ['Tarifa por hora', dinero(contrato.tarifaHora, cfg.simbolo_moneda)],
      ['Importe total', dinero(contrato.importe, cfg.simbolo_moneda)],
    ],
    anchos: [150, 330],
    tamano: 8.8,
    altoMinimo: 18,
  });
  doc.salto(16);

  doc.texto('CLÁUSULAS', {
    tamano: 9,
    negrita: true,
    color: [0.106, 0.369, 0.125],
    interlineado: 13,
  });
  doc.salto(4);
  (contrato.clausulas || []).forEach((clausula, i) => {
    doc.parrafo(`${i + 1}. ${clausula}`, {
      tamano: 9.2,
      interlineado: 13,
      espacioDespues: 7,
    });
  });
  if (!(contrato.clausulas || []).length) {
    doc.parrafo('El contrato no contiene cláusulas variables registradas.', {
      tamano: 9.2,
      italica: true,
      interlineado: 13,
    });
  }

  doc.salto(4);
  doc.parrafo(
    'El presente contrato se rige por la Resolución 210/2023 del Ministerio de Educación Superior y demás ' +
      'disposiciones vigentes. El pago se procesará dentro de los 30 días posteriores a la finalización del ' +
      'contrato, previa certificación de las horas impartidas.',
    { tamano: 8.6, color: [0.32, 0.37, 0.33], interlineado: 12 },
  );

  doc.asegurarEspacio(110);
  doc.salto(28);
  const yFirma = doc.cursor - 8;
  doc.firma({
    x: 52,
    y: yFirma,
    titulo: 'POR EL DEPARTAMENTO',
    nombre: 'Jefe de Departamento de Informática',
    cargo: cfg.nombre_institucion,
  });
  doc.firma({
    x: 320,
    y: yFirma,
    titulo: 'POR EL PROFESOR',
    nombre: contrato.profesor,
    cargo: `CI ${contrato.ci || '—'} · ${contrato.categoriaDocente || ''}`,
  });
  doc.cursor = yFirma - 58;
}

export function pdfContrato(contrato, cfg) {
  const doc = new DocumentoPDF({
    titulo: `Contrato ${contrato.codigo}`,
    asunto: 'Contrato docente',
  });
  dibujarContrato(doc, contrato, cfg, true);
  return doc.generar();
}

export function pdfContratos(contratos, cfg) {
  const doc = new DocumentoPDF({
    titulo: 'Contratos docentes',
    asunto: 'Copia de contratos',
  });
  contratos.forEach((contrato, i) => {
    dibujarContrato(doc, contrato, cfg, i === 0);
  });
  return doc.generar();
}

/* ------------------------------------------------------------------ */
/* Reporte de pagos                                                    */
/* ------------------------------------------------------------------ */

export function pdfPagos(pagos, cfg, { periodo = '' } = {}) {
  const doc = new DocumentoPDF({ titulo: 'Reporte de pagos', asunto: 'Liquidación de pagos' });
  doc.encabezadoInstitucional('Reporte de pagos');
  doc.cursor -= 4;
  doc.texto('REPORTE DE PAGOS POR SOBRECARGA DOCENTE', {
    tamano: 14,
    negrita: true,
    color: [0.106, 0.369, 0.125],
    interlineado: 19,
  });
  doc.texto(
    `${periodo ? `Período: ${periodo} · ` : ''}Generado: ${sello()} · Registros: ${pagos.length}`,
    { tamano: 8.6, color: [0.38, 0.43, 0.39], interlineado: 13 },
  );
  doc.salto(12);

  const total = pagos.reduce((s, p) => s + p.importe, 0);
  doc.tabla({
    columnas: ['Contrato', 'Profesor', 'Período', 'Horas', 'Importe', 'Estado', 'Límite'],
    filas: [
      ...pagos.map((p) => [
        p.contrato,
        p.profesor,
        p.periodo,
        String(p.horas),
        dinero(p.importe, cfg.simbolo_moneda),
        p.estado,
        fechaCorta(p.fechaLimite),
      ]),
      ['TOTAL', '', '', String(pagos.reduce((s, p) => s + p.horas, 0)), dinero(total, cfg.simbolo_moneda), '', ''],
    ],
    anchos: [90, 150, 70, 45, 80, 70, 65],
    tamano: 8,
    alinear: ['izquierda', 'izquierda', 'izquierda', 'derecha', 'derecha', 'centro', 'centro'],
  });
  doc.salto(24);
  doc.parrafo(
    'Documento generado automáticamente por el Sistema de Gestión de Contratos Determinados y Pagos por ' +
      'Sobrecarga Docente. Las cifras están expresadas en ' +
      `${cfg.moneda}.`,
    { tamano: 8.2, color: [0.42, 0.47, 0.43], interlineado: 11.5 },
  );
  doc.salto(40);
  doc.firma({
    x: 52,
    y: doc.cursor,
    titulo: 'ELABORADO POR',
    nombre: 'Departamento de Informática',
    cargo: cfg.nombre_institucion,
  });
  doc.firma({
    x: 320,
    y: doc.cursor,
    titulo: 'APROBADO POR',
    nombre: 'Jefe de Departamento',
    cargo: 'Firma y cuño',
  });
  return doc.generar();
}

/* ------------------------------------------------------------------ */
/* Excel                                                               */
/* ------------------------------------------------------------------ */

export function xlsxProfesores(profesores, cfg) {
  return construirXlsx({
    hojas: [
      {
        nombre: 'Profesores',
        titulo: 'Prenómina de Profesores — Registro del Departamento de Informática',
        subtitulo: `${cfg.nombre_institucion} · Generado: ${sello()}`,
        cabeceras: [
          'No.', 'No. Trabajador', 'Nombre y Apellidos', 'CI', 'Año', 'Área',
          'Área de la Ciencia', 'Categoría PoC', 'Categoría Docente', 'Carga (h)',
          'Correo', 'Teléfono', 'Activo',
        ],
        filas: profesores.map((p, i) => [
          i + 1,
          p.noTrabajador,
          p.nombre,
          p.ci,
          p.anio,
          p.area,
          p.areaCiencia,
          p.categoriaPoc,
          p.categoriaDocente,
          p.cargaHoraria,
          p.correo,
          p.telefono,
          p.activo ? 'Sí' : 'No',
        ]),
        totales: ['TOTAL', '', `${profesores.length} profesores`, '', '', '', '', '', '', '', '', '', ''],
        anchos: [5, 14, 30, 12, 10, 26, 24, 12, 16, 9, 28, 14, 8],
        numero: [9],
      },
    ],
  });
}

export function xlsxPrenomina(datos, cfg) {
  const cortes = datos.periodo.cortes;
  const cabecerasHoras = Array.from({ length: cortes }, (_, i) => String(i + 1));
  const cabeceras = [
    'No.', 'Nombre y Apellidos', 'Categoría PoC', 'Categoría Docente',
    ...cabecerasHoras, 'THP', 'HSP', 'TPP',
  ];
  const filas = datos.profesores.map((p, i) => [
    i + 1, p.nombre, p.categoriaPoc, p.categoriaDocente,
    ...p.horas, p.thp, p.hsp, p.tpp,
  ]);
  const sumaHoras = Array.from({ length: cortes }, (_, c) =>
    datos.profesores.reduce((s, p) => s + (p.horas[c] || 0), 0),
  );
  const totales = [
    'TOTAL', '', '', '',
    ...sumaHoras, datos.totales.thp, datos.totales.hsp, datos.totales.tpp,
  ];
  const columnasMoneda = [4 + cortes + 2];
  const columnasNumero = Array.from({ length: cortes + 2 }, (_, i) => 4 + i);

  return construirXlsx({
    hojas: [
      {
        nombre: `Prenómina ${datos.periodo.nombre}`.slice(0, 31),
        titulo: `Calculadora de Prenómina de Profesores — ${datos.periodo.nombre}`,
        subtitulo:
          `${cfg.nombre_institucion} · Cortes: ${cortes} · Profesores: ${datos.profesores.length} · ` +
          `Generado: ${sello()}`,
        cabeceras,
        filas,
        totales,
        anchos: [5, 30, 12, 16, ...Array(cortes).fill(9), 10, 10, 14],
        moneda: columnasMoneda,
        numero: columnasNumero,
      },
      {
        nombre: 'Resumen por categoría',
        titulo: 'Resumen de horas y pagos por categoría docente',
        subtitulo: `Período ${datos.periodo.nombre} · Moneda: ${cfg.moneda}`,
        cabeceras: ['Categoría Docente', 'THP (horas)', 'HSP (horas)', 'TPP (importe)'],
        filas: datos.resumenCategorias.map((r) => [r.categoriaDocente, r.thp, r.hsp, r.tpp]),
        totales: ['TOTAL', datos.totales.thp, datos.totales.hsp, datos.totales.tpp],
        anchos: [26, 16, 16, 18],
        moneda: [3],
        numero: [1, 2],
      },
    ],
  });
}

export function xlsxPagos(pagos, cfg, { periodo = '' } = {}) {
  return construirXlsx({
    hojas: [
      {
        nombre: 'Pagos',
        titulo: `Liquidación de pagos${periodo ? ` — ${periodo}` : ''}`,
        subtitulo: `${cfg.nombre_institucion} · Moneda: ${cfg.moneda} · Generado: ${sello()}`,
        cabeceras: [
          'No.', 'Contrato', 'Profesor', 'Período', 'Horas', 'Tarifa',
          'Importe', 'Estado', 'Fecha límite', 'Fecha de pago', 'Vencido',
        ],
        filas: pagos.map((p, i) => [
          i + 1, p.contrato, p.profesor, p.periodo, p.horas, p.tarifa, p.importe,
          p.estado, p.fechaLimite, p.fechaPago || '', p.vencido ? 'Sí' : 'No',
        ]),
        totales: [
          'TOTAL', '', '', '', pagos.reduce((s, p) => s + p.horas, 0), '',
          pagos.reduce((s, p) => s + p.importe, 0), '', '', '', '',
        ],
        anchos: [5, 12, 30, 10, 8, 10, 13, 12, 12, 12, 9],
        moneda: [5, 6],
        numero: [4],
      },
    ],
  });
}
