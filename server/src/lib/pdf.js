/**
 * Generador de PDF sin dependencias externas (PDF 1.4, fuentes base 14, WinAnsi).
 * Pensado para contratos y reportes tabulares con acentos y símbolos del español.
 */

const ANCHO_A4 = 595.28;
const ALTO_A4 = 841.89;
const MARGEN = 52;
const VERDE = [0.106, 0.369, 0.125];
const VERDE_CLARO = [0.933, 0.965, 0.937];
const GRIS = [0.35, 0.4, 0.36];

const MAPA_WINANSI = new Map([
  ['€', 0x80], ['‚', 0x82], ['ƒ', 0x83], ['„', 0x84], ['…', 0x85], ['†', 0x86],
  ['‡', 0x87], ['ˆ', 0x88], ['‰', 0x89], ['Š', 0x8a], ['‹', 0x8b], ['Œ', 0x8c],
  ['Ž', 0x8e], ['‘', 0x91], ['’', 0x92], ['“', 0x93], ['”', 0x94], ['•', 0x95],
  ['–', 0x96], ['—', 0x97], ['˜', 0x98], ['™', 0x99], ['š', 0x9a], ['›', 0x9b],
  ['œ', 0x9c], ['ž', 0x9e], ['Ÿ', 0x9f],
]);

function cadenaPdf(texto) {
  let salida = '(';
  for (const caracter of String(texto)) {
    let byte = MAPA_WINANSI.get(caracter);
    if (byte === undefined) byte = caracter.codePointAt(0) <= 0xff ? caracter.codePointAt(0) : 0x3f;
    if (byte === 0x28) salida += '\\(';
    else if (byte === 0x29) salida += '\\)';
    else if (byte === 0x5c) salida += '\\\\';
    else salida += String.fromCharCode(byte);
  }
  return `${salida})`;
}

const ANCHOS = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
  J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667,
  T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, '[': 278, '\\': 278,
  ']': 278, '^': 469, _: 556, '`': 333, a: 556, b: 556, c: 500, d: 556, e: 556,
  f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556,
  p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500,
  z: 500, '{': 334, '|': 260, '}': 334, '~': 584,
};
const ACENTOS = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n', Á: 'A', É: 'E', Í: 'I',
  Ó: 'O', Ú: 'U', Ü: 'U', Ñ: 'N', '¿': '?', '¡': '!',
};

export function anchoTexto(texto, tamano, negrita = false) {
  let total = 0;
  for (const caracter of String(texto)) {
    total += ANCHOS[caracter] ?? ANCHOS[ACENTOS[caracter]] ?? 556;
  }
  return (total / 1000) * tamano * (negrita ? 1.07 : 1);
}

export function partirTexto(texto, anchoMax, tamano, negrita = false) {
  const palabras = String(texto ?? '').split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (!actual || anchoTexto(prueba, tamano, negrita) <= anchoMax) {
      actual = prueba;
    } else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [''];
}

export class DocumentoPDF {
  constructor({ titulo = '', asunto = 'Documento', autor = 'Prenómina UPR' } = {}) {
    this.titulo = titulo;
    this.asunto = asunto;
    this.autor = autor;
    this.paginas = [];
    this.nuevaPagina();
  }

  get anchoUtil() {
    return ANCHO_A4 - MARGEN * 2;
  }

  get pagina() {
    return this._activa || this.paginas[this.paginas.length - 1];
  }

  get cursor() {
    return this.pagina.y;
  }

  set cursor(valor) {
    this.pagina.y = valor;
  }

  nuevaPagina() {
    this.paginas.push({ operaciones: [], y: ALTO_A4 - MARGEN });
  }

  /** Dibuja texto en una posición fija sin mover el cursor ni crear páginas. */
  escribirEn(texto, x, y, opciones = {}) {
    const {
      tamano = 10,
      negrita = false,
      italica = false,
      color = [0.08, 0.1, 0.09],
      maxAncho = this.anchoUtil,
      interlineado = tamano * 1.4,
    } = opciones;
    const fuente = negrita ? '/F2' : italica ? '/F3' : '/F1';
    const lineas = partirTexto(texto, maxAncho, tamano, negrita);
    let yLinea = y;
    for (const linea of lineas) {
      this.pagina.operaciones.push(
        `BT ${color[0]} ${color[1]} ${color[2]} rg ${fuente} ${tamano} Tf ` +
          `1 0 0 1 ${x.toFixed(2)} ${yLinea.toFixed(2)} Tm ${cadenaPdf(linea)} Tj ET`,
      );
      yLinea -= interlineado;
    }
    return yLinea + interlineado;
  }

  /** Texto en el flujo normal: avanza el cursor y salta de página si hace falta. */
  texto(texto, opciones = {}) {
    const tamano = opciones.tamano || 10;
    const interlineado = opciones.interlineado || tamano * 1.45;
    const lineas = partirTexto(texto, opciones.maxAncho || this.anchoUtil, tamano, opciones.negrita);
    for (const linea of lineas) {
      if (this.cursor < MARGEN + 46) this.nuevaPagina();
      this.escribirEn(linea, opciones.x ?? MARGEN, this.cursor, {
        ...opciones,
        tamano,
        interlineado,
      });
      this.cursor -= interlineado;
    }
    return this.cursor;
  }

  parrafo(texto, opciones = {}) {
    this.texto(texto, opciones);
    this.cursor -= opciones.espacioDespues ?? 6;
  }

  linea(x1, y1, x2, y2, { grosor = 0.7, color = [0.78, 0.82, 0.79] } = {}) {
    this.pagina.operaciones.push(
      `${color[0]} ${color[1]} ${color[2]} RG ${grosor} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ` +
        `${x2.toFixed(2)} ${y2.toFixed(2)} l S`,
    );
  }

  rect(x, y, ancho, alto, { color = VERDE_CLARO, borde = null } = {}) {
    this.pagina.operaciones.push(
      `${color[0]} ${color[1]} ${color[2]} rg ${x.toFixed(2)} ${y.toFixed(2)} ` +
        `${ancho.toFixed(2)} ${alto.toFixed(2)} re f`,
    );
    if (borde) {
      this.pagina.operaciones.push(
        `${borde[0]} ${borde[1]} ${borde[2]} RG 0.6 w ${x.toFixed(2)} ${y.toFixed(2)} ` +
          `${ancho.toFixed(2)} ${alto.toFixed(2)} re S`,
      );
    }
  }

  encabezadoInstitucional(subtitulo = '') {
    this.rect(0, ALTO_A4 - 62, ANCHO_A4, 62, { color: VERDE });
    this.escribirEn('UNIVERSIDAD DE PINAR DEL RÍO «HERMANOS SAÍZ MONTES DE OCA»', MARGEN, ALTO_A4 - 25, {
      tamano: 8.4,
      negrita: true,
      color: [1, 1, 1],
      maxAncho: this.anchoUtil,
    });
    this.escribirEn(
      `Facultad de Ciencias Técnicas · Departamento de Informática${subtitulo ? ` · ${subtitulo}` : ''}`,
      MARGEN,
      ALTO_A4 - 42,
      { tamano: 7.4, color: [0.86, 0.94, 0.87], maxAncho: this.anchoUtil },
    );
    this.cursor = ALTO_A4 - 62 - 24;
  }

  asegurarEspacio(alto) {
    if (this.cursor - alto < MARGEN + 34) {
      this.nuevaPagina();
      return true;
    }
    return false;
  }

  salto(espacio = 8) {
    this.cursor -= espacio;
  }

  tabla({ columnas, filas, anchos, cabecera = true, tamano = 8.4, altoMinimo = 16, alinear = [] }) {
    const x0 = MARGEN;
    const total = anchos.reduce((s, a) => s + a, 0);
    const escala = this.anchoUtil / total;
    const anchosEscalados = anchos.map((a) => a * escala);

    const dibujarCabecera = () => {
      this.rect(x0, this.cursor - altoMinimo, this.anchoUtil, altoMinimo, { color: VERDE });
      let x = x0;
      columnas.forEach((col, i) => {
        this.escribirEn(col, x + 5, this.cursor - tamano - 4, {
          tamano,
          negrita: true,
          color: [1, 1, 1],
          maxAncho: anchosEscalados[i] - 10,
          interlineado: tamano * 1.25,
        });
        x += anchosEscalados[i];
      });
      this.cursor -= altoMinimo;
    };

    this.asegurarEspacio(altoMinimo * 3);
    if (cabecera) dibujarCabecera();

    let indice = 0;
    for (const fila of filas) {
      const lineasPorCelda = fila.map((valor, i) =>
        partirTexto(String(valor ?? ''), anchosEscalados[i] - 10, tamano),
      );
      const maxLineas = Math.max(...lineasPorCelda.map((l) => l.length), 1);
      const alto = Math.max(altoMinimo, maxLineas * (tamano * 1.3) + 8);
      if (this.cursor - alto < MARGEN + 26) {
        this.nuevaPagina();
        if (cabecera) dibujarCabecera();
      }
      if (indice % 2 === 1) {
        this.rect(x0, this.cursor - alto, this.anchoUtil, alto, { color: [0.965, 0.976, 0.966] });
      }
      let x = x0;
      fila.forEach((valor, i) => {
        const texto = String(valor ?? '');
        const negrita = texto === 'TOTAL';
        const alineacion = alinear[i] || 'izquierda';
        let xTexto = x + 5;
        if (alineacion === 'derecha') {
          xTexto = x + anchosEscalados[i] - 5 - anchoTexto(texto, tamano, negrita);
        } else if (alineacion === 'centro') {
          xTexto = x + (anchosEscalados[i] - anchoTexto(texto, tamano, negrita)) / 2;
        }
        this.escribirEn(texto, Math.max(x + 4, xTexto), this.cursor - tamano - 4, {
          tamano,
          negrita,
          maxAncho: anchosEscalados[i] - 10,
          interlineado: tamano * 1.3,
        });
        x += anchosEscalados[i];
      });
      this.cursor -= alto;
      this.linea(x0, this.cursor, x0 + this.anchoUtil, this.cursor, {
        grosor: 0.5,
        color: [0.86, 0.9, 0.87],
      });
      indice += 1;
    }
  }

  firma({ x, y, ancho = 190, titulo, nombre, cargo }) {
    this.linea(x, y, x + ancho, y, { grosor: 0.9, color: GRIS });
    this.escribirEn(titulo, x, y - 13, { tamano: 8, negrita: true, maxAncho: ancho });
    this.escribirEn(nombre, x, y - 25, { tamano: 8.5, maxAncho: ancho });
    this.escribirEn(cargo, x, y - 36, { tamano: 7.4, color: [0.42, 0.47, 0.43], maxAncho: ancho });
  }

  pieDePagina() {
    const total = this.paginas.length;
    this.paginas.forEach((pagina, i) => {
      const y = 34;
      const guardado = pagina.y;
      this._activa = pagina;
      this.linea(MARGEN, y + 12, ANCHO_A4 - MARGEN, y + 12, { grosor: 0.5 });
      this.escribirEn(
        `Prenómina UPR · ${new Date().toLocaleString('es-CU')}`,
        MARGEN,
        y,
        { tamano: 7.2, color: [0.45, 0.5, 0.46], maxAncho: 380 },
      );
      this.escribirEn(`Página ${i + 1} de ${total}`, ANCHO_A4 - MARGEN - 90, y, {
        tamano: 7.2,
        color: [0.45, 0.5, 0.46],
        maxAncho: 90,
      });
      pagina.y = guardado;
      this._activa = null;
    });
  }

  generar() {
    this.pieDePagina();
    const paginas = this.paginas.length;
    const primera = 6;
    const kids = this.paginas.map((_, i) => `${primera + i * 2} 0 R`).join(' ');
    const objetos = [];
    objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objetos[2] = `<< /Type /Pages /Kids [${kids}] /Count ${paginas} >>`;
    objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objetos[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objetos[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>';

    this.paginas.forEach((pagina, i) => {
      const numPagina = primera + i * 2;
      const numContenido = numPagina + 1;
      objetos[numPagina] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO_A4} ${ALTO_A4}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${numContenido} 0 R >>`;
      const flujo = pagina.operaciones.join('\n');
      objetos[numContenido] =
        `<< /Length ${Buffer.byteLength(flujo, 'latin1')} >>\nstream\n${flujo}\nendstream`;
    });

    const numInfo = primera + this.paginas.length * 2;
    const sello = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    objetos[numInfo] =
      `<< /Title ${cadenaPdf(this.titulo)} /Author ${cadenaPdf(this.autor)} ` +
      `/Subject ${cadenaPdf(this.asunto)} /Producer (Prenomina UPR) /CreationDate (D:${sello}Z) >>`;

    let cuerpo = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [0];
    for (let i = 1; i <= numInfo; i += 1) {
      offsets[i] = Buffer.byteLength(cuerpo, 'latin1');
      cuerpo += `${i} 0 obj\n${objetos[i]}\nendobj\n`;
    }
    const inicioXref = Buffer.byteLength(cuerpo, 'latin1');
    let xref = `xref\n0 ${numInfo + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= numInfo; i += 1) {
      xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    cuerpo += `${xref}trailer\n<< /Size ${numInfo + 1} /Root 1 0 R /Info ${numInfo} 0 R >>\n`;
    cuerpo += `startxref\n${inicioXref}\n%%EOF\n`;
    return Buffer.from(cuerpo, 'latin1');
  }
}
