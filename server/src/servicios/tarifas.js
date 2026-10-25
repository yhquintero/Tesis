import { all, get } from '../db.js';
import { errores } from '../lib/http.js';

export const CATEGORIAS_DOCENTES = [
  'Titular',
  'Auxiliar',
  'Asistente',
  'Instructor',
  'ATD Nivel superior',
  'ATD Nivel medio',
  'Recién graduados',
];

export function tarifaVigente(categoriaDocente, tipo, fechaISO) {
  const fila = get(
    `SELECT * FROM tarifas
      WHERE categoria_docente = ? AND tipo = ? AND vigente_desde <= ?
      ORDER BY vigente_desde DESC LIMIT 1`,
    categoriaDocente,
    tipo,
    fechaISO,
  );
  if (!fila) {
    throw errores.regla(
      `No hay tarifa configurada para la categoría "${categoriaDocente}" y el tipo "${tipo}". ` +
        'Un administrador debe registrar la tarifa en Configuración.',
    );
  }
  return fila;
}

export function listarTarifas() {
  return all('SELECT * FROM tarifas ORDER BY categoria_docente, tipo, vigente_desde DESC').map(
    (t) => ({
      id: t.id,
      categoriaDocente: t.categoria_docente,
      tipo: t.tipo,
      importe: t.importe,
      vigenteDesde: t.vigente_desde,
    }),
  );
}

export function matrizTarifas(fechaISO = new Date().toISOString().slice(0, 10)) {
  const matriz = {};
  for (const categoria of CATEGORIAS_DOCENTES) {
    matriz[categoria] = {};
    for (const tipo of ['determinado', 'sobrecarga']) {
      const fila = get(
        `SELECT importe FROM tarifas
          WHERE categoria_docente = ? AND tipo = ? AND vigente_desde <= ?
          ORDER BY vigente_desde DESC LIMIT 1`,
        categoria,
        tipo,
        fechaISO,
      );
      matriz[categoria][tipo] = fila ? fila.importe : null;
    }
  }
  return matriz;
}
