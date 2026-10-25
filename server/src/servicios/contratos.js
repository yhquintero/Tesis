import { all, get, run, transaccion } from '../db.js';
import { errores } from '../lib/http.js';
import * as v from '../lib/validar.js';
import { tarifaVigente } from './tarifas.js';
import { diasEntre, hoyISO, moneda, sumarDias, sumarMeses } from './util.js';

export const ESTADOS = ['borrador', 'pendiente', 'aprobado', 'activo', 'completado', 'rechazado', 'cancelado'];
export const TIPOS = ['determinado', 'sobrecarga'];

const TRANSICIONES = {
  borrador: ['pendiente', 'cancelado'],
  pendiente: ['aprobado', 'rechazado', 'cancelado'],
  aprobado: ['activo', 'cancelado'],
  activo: ['completado', 'cancelado'],
  rechazado: ['borrador', 'cancelado'],
  completado: [],
  cancelado: [],
};

const ETIQUETAS = {
  borrador: 'Borrador',
  pendiente: 'Pendiente de aprobación',
  aprobado: 'Aprobado',
  activo: 'Activo',
  completado: 'Completado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

export function etiquetaEstado(estado) {
  return ETIQUETAS[estado] || estado;
}

export function serializar(fila) {
  if (!fila) return null;
  const hoy = hoyISO();
  const vencido = fila.fecha_fin < hoy && !['completado', 'cancelado'].includes(fila.estado);
  return {
    id: fila.id,
    codigo: fila.codigo,
    profesorId: fila.profesor_id,
    profesor: fila.profesor_nombre || undefined,
    noTrabajador: fila.no_trabajador || undefined,
    ci: fila.ci || undefined,
    categoriaDocente: fila.categoria_docente || undefined,
    tipo: fila.tipo,
    objeto: fila.objeto,
    periodo: fila.periodo,
    fechaInicio: fila.fecha_inicio,
    fechaFin: fila.fecha_fin,
    horas: fila.horas,
    tarifaHora: fila.tarifa_hora,
    importe: fila.importe,
    clausulas: JSON.parse(fila.clausulas || '[]'),
    estado: fila.estado,
    etiquetaEstado: ETIQUETAS[fila.estado] || fila.estado,
    observaciones: fila.observaciones,
    motivoRechazo: fila.motivo_rechazo,
    aprobadoPor: fila.aprobado_por,
    aprobadoEn: fila.aprobado_en,
    creadoPor: fila.creado_por,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
    diasParaVencer: diasEntre(hoy, fila.fecha_fin),
    vencido,
    duracionMeses: Math.round((diasEntre(fila.fecha_inicio, fila.fecha_fin) / 30.4375) * 10) / 10,
  };
}

const BASE = `
  SELECT c.*, p.nombre AS profesor_nombre, p.no_trabajador, p.ci, p.categoria_docente
    FROM contratos c
    JOIN profesores p ON p.id = c.profesor_id
`;

export function obtener(id) {
  const fila = get(`${BASE} WHERE c.id = ?`, id);
  if (!fila) throw errores.noExiste('El contrato no existe.');
  const contrato = serializar(fila);
  contrato.pagos = all(
    `SELECT * FROM pagos WHERE contrato_id = ? ORDER BY periodo DESC, id DESC`,
    id,
  ).map((p) => ({
    id: p.id,
    periodo: p.periodo,
    horas: p.horas,
    tarifa: p.tarifa,
    importe: p.importe,
    estado: p.estado,
    fechaLimite: p.fecha_limite,
    fechaPago: p.fecha_pago,
    vencido: p.fecha_limite < hoyISO() && p.estado !== 'pagado',
  }));
  contrato.horasPagadas = contrato.pagos
    .filter((p) => p.estado !== 'anulado')
    .reduce((s, p) => s + p.horas, 0);
  return contrato;
}

export function listar({ q, estado, tipo, profesorId, offset, limit }) {
  const condiciones = [];
  const params = [];
  if (estado) {
    condiciones.push('c.estado = ?');
    params.push(estado);
  }
  if (tipo) {
    condiciones.push('c.tipo = ?');
    params.push(tipo);
  }
  if (profesorId) {
    condiciones.push('c.profesor_id = ?');
    params.push(profesorId);
  }
  if (q) {
    condiciones.push('(c.codigo LIKE ? OR c.objeto LIKE ? OR p.nombre LIKE ? OR p.no_trabajador LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const total = get(`SELECT COUNT(*) AS n FROM contratos c JOIN profesores p ON p.id = c.profesor_id ${where}`, ...params).n;
  const filas = all(
    `${BASE} ${where} ORDER BY c.creado_en DESC, c.id DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );
  return { items: filas.map(serializar), total };
}

export function siguienteCodigo(tipo) {
  const prefijo = tipo === 'determinado' ? 'CD' : 'CS';
  const anio = new Date().getUTCFullYear();
  const base = `${prefijo}-${anio}-`;
  const fila = get(
    `SELECT codigo FROM contratos WHERE codigo LIKE ? ORDER BY codigo DESC LIMIT 1`,
    `${base}%`,
  );
  let siguiente = 1;
  if (fila) siguiente = Number.parseInt(fila.codigo.slice(base.length), 10) + 1;
  return `${base}${String(siguiente).padStart(3, '0')}`;
}

export function validarFechas(fechaInicio, fechaFin) {
  const limite = sumarMeses(fechaInicio, 12);
  if (fechaFin > limite) {
    throw errores.regla(
      `El contrato no puede exceder 12 meses (máximo permitido hasta ${limite}).`,
      { fechaFin: 'La vigencia supera el límite de 12 meses.' },
    );
  }
}

export function crear(datos, usuario) {
  const profesorId = v.id(datos.profesorId, 'profesorId');
  const profesor = get('SELECT * FROM profesores WHERE id = ?', profesorId);
  if (!profesor) throw errores.noExiste('El profesor seleccionado no existe.');
  if (!profesor.activo) throw errores.regla('El profesor está inactivo y no puede firmar contratos.');

  const tipo = v.enumerado(datos.tipo, 'tipo', TIPOS);
  const objeto = v.texto(datos.objeto, 'objeto', { max: 300 });
  const fechaInicio = v.fecha(datos.fechaInicio, 'fechaInicio');
  const fechaFin = v.fecha(datos.fechaFin, 'fechaFin');
  if (fechaFin < fechaInicio) throw errores.validacion('La fecha final no puede ser anterior a la inicial.', { fechaFin: 'Rango inválido.' });
  validarFechas(fechaInicio, fechaFin);
  const horas = v.numero(datos.horas, 'horas', { min: 1, max: 2000 });
  const clausulas = v.arregloTexto(datos.clausulas, 'clausulas');
  const periodo = datos.periodo ? v.texto(datos.periodo, 'periodo', { max: 20, requerido: false }) : null;
  const observaciones = datos.observaciones ? v.texto(datos.observaciones, 'observaciones', { max: 1000, requerido: false }) : null;

  const tarifa = tarifaVigente(profesor.categoria_docente, tipo, fechaInicio);
  const importe = moneda(horas * tarifa.importe);

  return transaccion(() => {
    const codigo = siguienteCodigo(tipo);
    const resultado = run(
      `INSERT INTO contratos
        (codigo, profesor_id, tipo, objeto, periodo, fecha_inicio, fecha_fin, horas, tarifa_hora,
         importe, clausulas, estado, observaciones, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?, ?)`,
      codigo,
      profesorId,
      tipo,
      objeto,
      periodo,
      fechaInicio,
      fechaFin,
      horas,
      tarifa.importe,
      importe,
      JSON.stringify(clausulas.length ? clausulas : clausulasPorDefecto(tipo, profesor, horas, fechaInicio, fechaFin)),
      observaciones,
      usuario.id,
    );
    return obtener(Number(resultado.lastInsertRowid));
  });
}

export function clausulasPorDefecto(tipo, profesor, horas, inicio, fin) {
  return [
    `El profesor ${profesor.nombre} (CI ${profesor.ci}) prestará servicios docentes durante el período comprendido entre el ${inicio} y el ${fin}, con un total de ${horas} horas.`,
    tipo === 'determinado'
      ? 'El contrato se rige por la Resolución 210/2023 del MES para contratos determinados, con carácter temporal y sin relación laboral permanente.'
      : 'El pago corresponde a horas de sobrecarga docente, calculadas sobre la carga base del profesor y aprobadas según la Resolución 210/2023 del MES.',
    'El pago se procesará dentro de los 30 días posteriores a la finalización del contrato, previa certificación de las horas impartidas.',
    'Cualquier modificación de las condiciones pactadas requerirá la aprobación del jefe de departamento y quedará registrada en el sistema.',
  ];
}

export function actualizar(id, datos) {
  const actual = get('SELECT * FROM contratos WHERE id = ?', id);
  if (!actual) throw errores.noExiste('El contrato no existe.');
  if (!['borrador', 'rechazado'].includes(actual.estado)) {
    throw errores.regla('Solo pueden modificarse contratos en borrador o rechazados.');
  }
  const profesorId = datos.profesorId !== undefined ? v.id(datos.profesorId, 'profesorId') : actual.profesor_id;
  const profesor = get('SELECT * FROM profesores WHERE id = ?', profesorId);
  if (!profesor) throw errores.noExiste('El profesor seleccionado no existe.');
  if (!profesor.activo) throw errores.regla('El profesor está inactivo.');
  const tipo = datos.tipo !== undefined ? v.enumerado(datos.tipo, 'tipo', TIPOS) : actual.tipo;
  const objeto = datos.objeto !== undefined ? v.texto(datos.objeto, 'objeto', { max: 300 }) : actual.objeto;
  const fechaInicio = datos.fechaInicio ? v.fecha(datos.fechaInicio, 'fechaInicio') : actual.fecha_inicio;
  const fechaFin = datos.fechaFin ? v.fecha(datos.fechaFin, 'fechaFin') : actual.fecha_fin;
  if (fechaFin < fechaInicio) throw errores.validacion('La fecha final no puede ser anterior a la inicial.', { fechaFin: 'Rango inválido.' });
  validarFechas(fechaInicio, fechaFin);
  const horas = datos.horas !== undefined ? v.numero(datos.horas, 'horas', { min: 1, max: 2000 }) : actual.horas;
  const clausulas = datos.clausulas !== undefined ? v.arregloTexto(datos.clausulas, 'clausulas') : JSON.parse(actual.clausulas || '[]');
  const periodo = datos.periodo !== undefined ? v.texto(datos.periodo, 'periodo', { max: 20, requerido: false }) : actual.periodo;
  const observaciones = datos.observaciones !== undefined
    ? v.texto(datos.observaciones, 'observaciones', { max: 1000, requerido: false })
    : actual.observaciones;

  const tarifa = tarifaVigente(profesor.categoria_docente, tipo, fechaInicio);
  const importe = moneda(horas * tarifa.importe);
  run(
    `UPDATE contratos SET profesor_id = ?, tipo = ?, objeto = ?, periodo = ?, fecha_inicio = ?,
       fecha_fin = ?, horas = ?, tarifa_hora = ?, importe = ?, clausulas = ?, observaciones = ?,
       actualizado_en = ?
     WHERE id = ?`,
    profesorId,
    tipo,
    objeto,
    periodo,
    fechaInicio,
    fechaFin,
    horas,
    tarifa.importe,
    importe,
    JSON.stringify(clausulas),
    observaciones,
    new Date().toISOString(),
    id,
  );
  return obtener(id);
}

export function cambiarEstado(id, estado, usuario, motivo) {
  const actual = get(`${BASE} WHERE c.id = ?`, id);
  if (!actual) throw errores.noExiste('El contrato no existe.');
  if (!ESTADOS.includes(estado)) throw errores.validacion('Estado no válido.', { estado: 'Estado desconocido.' });
  if (estado === actual.estado) return obtener(id);
  const permitidos = TRANSICIONES[actual.estado] || [];
  if (!permitidos.includes(estado)) {
    throw errores.regla(
      `No se puede pasar de "${etiquetaEstado(actual.estado)}" a "${etiquetaEstado(estado)}".`,
    );
  }
  if (['aprobado', 'rechazado'].includes(estado) && usuario.rol !== 'admin') {
    throw errores.sinPermiso('Solo un administrador puede aprobar o rechazar contratos.');
  }
  if (estado === 'cancelado' && usuario.rol !== 'admin') {
    throw errores.sinPermiso('Solo un administrador puede cancelar contratos.');
  }
  if (estado === 'rechazado' && !motivo) {
    throw errores.validacion('Indique el motivo del rechazo.', { motivo: 'El motivo es obligatorio.' });
  }

  return transaccion(() => {
    const ahora = new Date().toISOString();
    run(
      `UPDATE contratos SET estado = ?, motivo_rechazo = ?, aprobado_por = ?, aprobado_en = ?,
         actualizado_en = ? WHERE id = ?`,
      estado,
      estado === 'rechazado' ? motivo : null,
      ['aprobado', 'rechazado'].includes(estado) ? usuario.id : actual.aprobado_por,
      ['aprobado', 'rechazado'].includes(estado) ? ahora : actual.aprobado_en,
      ahora,
      id,
    );

    if (estado === 'activo') {
      const existente = get('SELECT COUNT(*) AS n FROM pagos WHERE contrato_id = ?', id).n;
      if (!existente) {
        run(
          `INSERT INTO pagos (contrato_id, periodo, horas, tarifa, importe, estado, fecha_limite)
           VALUES (?, ?, ?, ?, ?, 'pendiente', ?)`,
          id,
          actual.periodo || actual.fecha_inicio.slice(0, 7),
          actual.horas,
          actual.tarifa_hora,
          moneda(actual.horas * actual.tarifa_hora),
          sumarDias(actual.fecha_fin, 30),
        );
      }
    }
    if (estado === 'cancelado' || estado === 'rechazado') {
      run(
        `UPDATE pagos SET estado = 'anulado' WHERE contrato_id = ? AND estado IN ('pendiente','aprobado')`,
        id,
      );
    }
    return obtener(id);
  });
}

export function eliminar(id) {
  const actual = get('SELECT * FROM contratos WHERE id = ?', id);
  if (!actual) throw errores.noExiste('El contrato no existe.');
  if (actual.estado !== 'borrador') {
    throw errores.regla('Solo pueden eliminarse contratos en estado borrador. Use la cancelación.');
  }
  run('DELETE FROM contratos WHERE id = ?', id);
}
