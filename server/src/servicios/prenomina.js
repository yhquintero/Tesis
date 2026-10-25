import { all, get, run, transaccion } from '../db.js';
import { errores } from '../lib/http.js';
import * as v from '../lib/validar.js';
import { tarifaVigente } from './tarifas.js';
import { moneda } from './util.js';

export function obtenerPeriodo(periodoId) {
  if (periodoId) {
    const periodo = get('SELECT * FROM periodos WHERE id = ?', periodoId);
    if (!periodo) throw errores.noExiste('El período no existe.');
    return periodo;
  }
  const abierto = get("SELECT * FROM periodos WHERE estado = 'abierto' ORDER BY inicio DESC LIMIT 1");
  if (abierto) return abierto;
  const ultimo = get('SELECT * FROM periodos ORDER BY inicio DESC LIMIT 1');
  if (!ultimo) throw errores.noExiste('No hay períodos configurados.');
  return ultimo;
}

function tarifasDelPeriodo(periodo) {
  const cache = new Map();
  return (categoria, tipo) => {
    const clave = `${categoria}|${tipo}`;
    if (!cache.has(clave)) {
      try {
        cache.set(clave, tarifaVigente(categoria, tipo, periodo.inicio).importe);
      } catch {
        cache.set(clave, null);
      }
    }
    return cache.get(clave);
  };
}

export function calcular(periodoId) {
  const periodo = obtenerPeriodo(periodoId);
  const tarifaDe = tarifasDelPeriodo(periodo);
  const profesores = all(
    'SELECT * FROM profesores WHERE activo = 1 ORDER BY nombre COLLATE NOCASE',
  );
  const filasCarga = all('SELECT profesor_id, corte, horas FROM cargas WHERE periodo_id = ?', periodo.id);
  const mapa = new Map();
  for (const fila of filasCarga) {
    if (!mapa.has(fila.profesor_id)) mapa.set(fila.profesor_id, new Map());
    mapa.get(fila.profesor_id).set(fila.corte, fila.horas);
  }

  const items = profesores.map((p) => {
    const horas = [];
    for (let i = 1; i <= periodo.cortes; i += 1) {
      horas.push(mapa.get(p.id)?.get(i) ?? 0);
    }
    const thp = moneda(horas.reduce((s, h) => s + h, 0));
    const hsp = moneda(horas.reduce((s, h) => s + Math.max(0, h - p.carga_horaria), 0));
    const base = moneda(thp - hsp);
    const tarifaBase = tarifaDe(p.categoria_docente, 'determinado');
    const tarifaSobre = tarifaDe(p.categoria_docente, 'sobrecarga');
    const tpp = moneda(
      base * (tarifaBase ?? 0) + hsp * (tarifaSobre ?? 0),
    );
    return {
      profesorId: p.id,
      noTrabajador: p.no_trabajador,
      nombre: p.nombre,
      ci: p.ci,
      anio: p.anio,
      categoriaPoc: p.categoria_poc,
      categoriaDocente: p.categoria_docente,
      cargaHoraria: p.carga_horaria,
      horas,
      thp,
      hsp,
      base,
      tarifaBase,
      tarifaSobrecarga: tarifaSobre,
      tpp,
      sinTarifa: tarifaBase === null || tarifaSobre === null,
    };
  });

  const resumenCategorias = [];
  for (const item of items) {
    let fila = resumenCategorias.find((r) => r.categoriaDocente === item.categoriaDocente);
    if (!fila) {
      fila = { categoriaDocente: item.categoriaDocente, thp: 0, hsp: 0, tpp: 0 };
      resumenCategorias.push(fila);
    }
    fila.thp = moneda(fila.thp + item.thp);
    fila.hsp = moneda(fila.hsp + item.hsp);
    fila.tpp = moneda(fila.tpp + item.tpp);
  }
  const orden = [
    'Titular',
    'Auxiliar',
    'Asistente',
    'Instructor',
    'ATD Nivel superior',
    'ATD Nivel medio',
    'Recién graduados',
  ];
  resumenCategorias.sort((a, b) => orden.indexOf(a.categoriaDocente) - orden.indexOf(b.categoriaDocente));

  const totales = {
    thp: moneda(items.reduce((s, i) => s + i.thp, 0)),
    hsp: moneda(items.reduce((s, i) => s + i.hsp, 0)),
    tpp: moneda(items.reduce((s, i) => s + i.tpp, 0)),
  };

  return {
    periodo: {
      id: periodo.id,
      nombre: periodo.nombre,
      inicio: periodo.inicio,
      fin: periodo.fin,
      cortes: periodo.cortes,
      estado: periodo.estado,
    },
    profesores: items,
    resumenCategorias,
    totales,
  };
}

export function guardarHoras(periodoId, profesorId, horas) {
  const periodo = obtenerPeriodo(periodoId);
  if (periodo.estado === 'cerrado') {
    throw errores.regla('El período está cerrado y no admite cambios.');
  }
  const profesor = get('SELECT * FROM profesores WHERE id = ?', profesorId);
  if (!profesor) throw errores.noExiste('El profesor no existe.');
  if (!Array.isArray(horas)) throw errores.validacion('Debe enviar la lista de horas por corte.');
  if (horas.length !== periodo.cortes) {
    throw errores.validacion(
      `El período ${periodo.nombre} tiene ${periodo.cortes} cortes; se recibieron ${horas.length}.`,
      { horas: 'Cantidad de cortes incorrecta.' },
    );
  }
  const valores = horas.map((h, i) => v.numero(h, `horas[${i}]`, { min: 0, max: 200 }));
  return transaccion(() => {
    run('DELETE FROM cargas WHERE periodo_id = ? AND profesor_id = ?', periodo.id, profesorId);
    const stmt = 'INSERT INTO cargas (periodo_id, profesor_id, corte, horas) VALUES (?, ?, ?, ?)';
    for (let i = 0; i < valores.length; i += 1) {
      run(stmt, periodo.id, profesorId, i + 1, valores[i]);
    }
    return calcular(periodo.id);
  });
}

/**
 * Genera contratos en borrador a partir de la prenómina: la parte de horas base
 * como contrato determinado y el exceso como contrato por sobrecarga.
 */
export function generarContratos(periodoId, usuario) {
  const periodo = obtenerPeriodo(periodoId);
  const datos = calcular(periodo.id);
  const creados = [];
  transaccion(() => {
    for (const item of datos.profesores) {
      if (item.thp <= 0) continue;
      const existentes = get(
        'SELECT COUNT(*) AS n FROM contratos WHERE profesor_id = ? AND periodo = ?',
        item.profesorId,
        periodo.nombre,
      ).n;
      if (existentes > 0) continue;
      const base = moneda(item.thp - item.hsp);
      const partes = [];
      if (base > 0) partes.push({ tipo: 'determinado', horas: base });
      if (item.hsp > 0) partes.push({ tipo: 'sobrecarga', horas: item.hsp });
      for (const parte of partes) {
        const fechaInicio = periodo.inicio;
        const fechaFin = periodo.fin;
        let tarifa;
        try {
          tarifa = tarifaVigente(item.categoriaDocente, parte.tipo, fechaInicio);
        } catch {
          continue;
        }
        const prefijo = parte.tipo === 'determinado' ? 'CD' : 'CS';
        const anio = fechaInicio.slice(0, 4);
        const ultimo = get(
          'SELECT codigo FROM contratos WHERE codigo LIKE ? ORDER BY codigo DESC LIMIT 1',
          `${prefijo}-${anio}-%`,
        );
        const secuencia = ultimo ? Number.parseInt(ultimo.codigo.slice(-3), 10) + 1 : 1;
        const codigo = `${prefijo}-${anio}-${String(secuencia).padStart(3, '0')}`;
        const resultado = run(
          `INSERT INTO contratos
            (codigo, profesor_id, tipo, objeto, periodo, fecha_inicio, fecha_fin, horas, tarifa_hora,
             importe, clausulas, estado, creado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'borrador', ?)`,
          codigo,
          item.profesorId,
          parte.tipo,
          `Horas ${parte.tipo === 'determinado' ? 'docentes' : 'de sobrecarga'} del período ${periodo.nombre}`,
          periodo.nombre,
          fechaInicio,
          fechaFin,
          parte.horas,
          tarifa.importe,
          moneda(parte.horas * tarifa.importe),
          usuario.id,
        );
        creados.push(Number(resultado.lastInsertRowid));
      }
    }
  });
  return { creados: creados.length, ids: creados };
}
