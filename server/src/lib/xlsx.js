import { crearZip } from './zip.js';

const esc = (valor) =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function letraColumna(indice) {
  let n = indice + 1;
  let salida = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    salida = String.fromCharCode(65 + resto) + salida;
    n = Math.floor((n - 1) / 26);
  }
  return salida;
}

function nombreHojaValido(nombre, usados) {
  let base = String(nombre || 'Hoja').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Hoja';
  let final = base;
  let i = 2;
  while (usados.has(final.toLowerCase())) {
    const sufijo = ` (${i})`;
    final = `${base.slice(0, 31 - sufijo.length)}${sufijo}`;
    i += 1;
  }
  usados.add(final.toLowerCase());
  return final;
}

function celda(ref, valor, estilo) {
  if (valor === null || valor === undefined || valor === '') {
    return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''}/>`;
  }
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''}><v>${valor}</v></c>`;
  }
  if (typeof valor === 'boolean') {
    return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''} t="b"><v>${valor ? 1 : 0}</v></c>`;
  }
  return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''} t="inlineStr"><is><t xml:space="preserve">${esc(valor)}</t></is></c>`;
}

function construirHoja(hoja) {
  const cabeceras = hoja.cabeceras || [];
  const filas = hoja.filas || [];
  const totales = hoja.totales || null;
  const columnas = Math.max(cabeceras.length, ...filas.map((f) => f.length), totales?.length || 0, 1);
  const moneda = new Set(hoja.moneda || []);
  const numeros = new Set(hoja.numero || []);
  const anchos = hoja.anchos || [];
  const filasXml = [];
  let filaActual = 1;

  const rango = `A1:${letraColumna(columnas - 1)}${Math.max(4, 4 + filas.length + (totales ? 1 : 0))}`;

  if (hoja.titulo) {
    filasXml.push(
      `<row r="1" ht="26" customHeight="1">${celda('A1', hoja.titulo, 1)}</row>`,
    );
    filaActual = 2;
  }
  if (hoja.subtitulo) {
    filasXml.push(`<row r="2" ht="16" customHeight="1">${celda('A2', hoja.subtitulo, 2)}</row>`);
    filaActual = 3;
  }
  filaActual = 3;
  filasXml.push(`<row r="4" ht="30" customHeight="1">`);
  const filaCabecera = [];
  for (let i = 0; i < columnas; i += 1) {
    filaCabecera.push(celda(`${letraColumna(i)}4`, cabeceras[i] ?? '', 3));
  }
  filasXml[filasXml.length - 1] += filaCabecera.join('') + '</row>';

  filas.forEach((fila, indice) => {
    const r = 5 + indice;
    const celdas = [];
    for (let i = 0; i < columnas; i += 1) {
      const estilo = moneda.has(i) ? 5 : numeros.has(i) ? 6 : 4;
      celdas.push(celda(`${letraColumna(i)}${r}`, fila[i] ?? null, estilo));
    }
    filasXml.push(`<row r="${r}">${celdas.join('')}</row>`);
  });

  let ultimaFila = 4 + filas.length;
  if (totales) {
    const r = 5 + filas.length;
    const celdas = [];
    for (let i = 0; i < columnas; i += 1) {
      const estilo = moneda.has(i) ? 8 : 7;
      celdas.push(celda(`${letraColumna(i)}${r}`, totales[i] ?? null, estilo));
    }
    filasXml.push(`<row r="${r}" ht="22" customHeight="1">${celdas.join('')}</row>`);
    ultimaFila = r;
  }

  const colsXml = Array.from({ length: columnas }, (_, i) => {
    const ancho = anchos[i] || (i === 0 ? 6 : 16);
    return `<col min="${i + 1}" max="${i + 1}" width="${ancho}" customWidth="1"/>`;
  }).join('');

  const combinaciones = [];
  if (hoja.titulo) combinaciones.push(`A1:${letraColumna(columnas - 1)}1`);
  if (hoja.subtitulo) combinaciones.push(`A2:${letraColumna(columnas - 1)}2`);
  const mergeXml = combinaciones.length
    ? `<mergeCells count="${combinaciones.length}">${combinaciones.map((c) => `<mergeCell ref="${c}"/>`).join('')}</mergeCells>`
    : '';

  const autofiltro = hoja.autofiltro === false ? '' : `<autoFilter ref="A4:${letraColumna(columnas - 1)}${4 + filas.length}"/>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="${rango}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18"/>
<cols>${colsXml}</cols>
<sheetData>${filasXml.join('')}</sheetData>
${autofiltro}
${mergeXml}
<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>
<headerFooter><oddFooter>&amp;L${esc(hoja.pie || 'Prenómina UPR')}&amp;R Página &amp;P de &amp;N</oddFooter></headerFooter>
</worksheet>`;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/><color theme="1"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>
<font><b/><sz val="16"/><name val="Calibri"/><color rgb="FF1B5E20"/></font>
<font><i/><sz val="10"/><name val="Calibri"/><color rgb="FF5F6B66"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF123D18"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1B5E20"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE7F3E9"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFC8D6CB"/></left><right style="thin"><color rgb="FFC8D6CB"/></right><top style="thin"><color rgb="FFC8D6CB"/></top><bottom style="thin"><color rgb="FFC8D6CB"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="0"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="164" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Genera un libro .xlsx con una o varias hojas. */
export function construirXlsx({ hojas, creador = 'Prenómina UPR' }) {
  const usados = new Set();
  const nombres = hojas.map((h) => nombreHojaValido(h.nombre, usados));
  const archivos = [];

  archivos.push({
    nombre: '[Content_Types].xml',
    contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${hojas
  .map(
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  )
  .join('\n')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
  });

  archivos.push({
    nombre: '_rels/.rels',
    contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
  });

  archivos.push({
    nombre: 'docProps/core.xml',
    contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Prenómina UPR</dc:title><dc:creator>${esc(creador)}</dc:creator>
<cp:lastModifiedBy>${esc(creador)}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created>
</cp:coreProperties>`,
  });

  archivos.push({
    nombre: 'docProps/app.xml',
    contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Prenómina UPR</Application></Properties>`,
  });

  archivos.push({
    nombre: 'xl/workbook.xml',
    contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<workbookPr/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/></bookViews>
<sheets>${nombres
      .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets>
<calcPr calcId="191029"/>
</workbook>`,
  });

  archivos.push({
    nombre: 'xl/_rels/workbook.xml.rels',
    contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${hojas
  .map(
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  )
  .join('\n')}
<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  });

  archivos.push({ nombre: 'xl/styles.xml', contenido: ESTILOS });
  hojas.forEach((hoja, i) => {
    archivos.push({ nombre: `xl/worksheets/sheet${i + 1}.xml`, contenido: construirHoja(hoja) });
  });

  return crearZip(archivos);
}
