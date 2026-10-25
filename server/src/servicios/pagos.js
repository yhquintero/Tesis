import { all, get, run, transaccion } from '../db.js';
import { errores } from '../lib/http.js';
import * as v from '../lib/validar.js';
import { hoyISO, moneda, sumarDias } from './util.js';

export const ESTADOS_PAGO = ['pendiente', 'aprobado', 'pagado', 'anulado'];

const TRANSICIONES = {
  pendiente: ['aprobado', 'anulado'],
  aprobado: ['pagado', 'anulado'],
  pagado: [],
  anulado: [],
};

export function serializar(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    contratoId: fila.contrato_id,
    contrato: fila.contrato_codigo || undefined,
    profesor: fila.profesor_nombre || undefined,
    tipoContrato: fila.contrato_tipo || undefined,
    periodo: fila.periodo,
    horas: fila.horas,
    tarifa: fila.tarifa,
    importe: fila.importe,
    estado: fila.estado,
    fechaLimite: fila.fecha_limite,
    fechaPago: fila.fecha_pago,
    aprobadoPor: fila.aprobado_por,
    aprobadoEn: fila.aprobado_en,
    observaciones: fila.observaciones,
    creadoEn: fila.creado_en,
    vencido: fila.fecha_limite < hoyISO() && !['pagado', 'anulado'].includes(fila.estado),
  };
}

const BASE = `
  SELECT pg.*, c.codigo AS contrato_codigo, c.tipo AS contrato_tipo, c.fecha_fin,
         pr.nombre AS profesor_nombre
    FROM pagos pg
    JOIN contratos c ON c.id = pg.contrato_id
    JOIN profesores pr ON pr.id = c.profesor_id
`;

export function obtener(id) {
  const fila = get(`${BASE} WHERE pg.id = ?`, id);
  if (!fila) throw errores.noExiste('El pago no existe.');
  return serializar(fila);
}

export function listar({ estado, periodo, contratoId, q, offset, limit }) {
  const condiciones = [];
  const params = [];
  if (estado) {
    condiciones.push('pg.estado = ?');
    params.push(estado);
  }
  if (periodo) {
    condiciones.push('pg.periodo = ?');
    params.push(periodo);
  }
  if (contratoId) {
    condiciones.push('pg.contrato_id = ?');
    params.push(contratoId);
  }
  if (q) {
    condiciones.push('(c.codigo LIKE ? OR pr.nombre LIKE ? OR pg.periodo LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const total = get(
    `SELECT COUNT(*) AS n FROM pagos pg JOIN contratos c ON c.id = pg.contrato_id
      JOIN profesores pr ON pr.id = c.profesor_id ${where}`,
    ...params,
  ).n;
  const filas = all(
    `${BASE} ${where} ORDER BY pg.creado_en DESC, pg.id DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );
  return { items: filas.map(serializar), total };
}

export function crear(datos, usuario) {
  const contratoId = v.id(datos.contratoId, 'contratoId');
  const contrato = get('SELECT * FROM contratos WHERE id = ?', contratoId);
  if (!contrato) throw errores.noExiste('El contrato no existe.');
  if (!['activo', 'completado'].includes(contrato.estado)) {
    throw errores.regla(
      'Solo pueden registrarse pagos para contratos activos o completados (regla de negocio RN4).',
    );
  }
  const periodo = v.texto(datos.periodo, 'periodo', { min: 4, max: 20 });
  const horas = v.numero(datos.horas, 'horas', { min: 0.5, max: 2000 });
  const observaciones = datos.observaciones
    ? v.texto(datos.observaciones, 'observaciones', { max: 500, requerido: false })
    : null;

  const yaPagado = get(
    `SELECT COALESCE(SUM(horas),0) AS h FROM pagos WHERE contrato_id = ? AND estado <> 'anulado'`,
    contratoId,
  ).h;
  if (yaPagado + horas > contrato.horas + 0.001) {
    throw errores.regla(
      `Las horas pagadas (${yaPagado}) más las solicitadas (${horas}) superan las horas del contrato (${contrato.horas}).`,
    );
  }
  const duplicado = get('SELECT id FROM pagos WHERE contrato_id = ? AND periodo = ?', contratoId, periodo);
  if (duplicado) throw errores.conflicto('Ya existe un pago para ese contrato y período.');

  const importe = moneda(horas * contrato.tarifa_hora);
  const resultado = run(
    `INSERT INTO pagos (contrato_id, periodo, horas, tarifa, importe, estado, fecha_limite, observaciones)
     VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
    contratoId,
    periodo,
    horas,
    contrato.tarifa_hora,
    importe,
    sumarDias(contrato.fecha_fin, 30),
    observaciones,
  );
  return obtener(Number(resultado.lastInsertRowid));
}

export function cambiarEstado(id, estado, usuario, { fechaPago, forzar = false } = {}) {
  const actual = get(`${BASE} WHERE pg.id = ?`, id);
  if (!actual) throw errores.noExiste('El pago no existe.');
  if (!ESTADOS_PAGO.includes(estado)) {
    throw errores.validacion('Estado de pago no válido.', { estado: 'Estado desconocido.' });
  }
  if (!(TRANSICIONES[actual.estado] || []).includes(estado)) {
    throw errores.regla(`No se puede pasar de "${actual.estado}" a "${estado}".`);
  }
  if (actual.estado === 'pagado') {
    throw errores.regla('Un pago ya pagado no puede modificarse.');
  }

  if (estado === 'aprobado') {
    if (actual.fecha_limite < hoyISO()) {
      if (!forzar) {
        throw errores.regla(
          `El plazo de 30 días venció el ${actual.fecha_limite}. Se requiere autorización expresa del administrador para aprobarlo fuera de plazo.`,
        );
      }
      if (usuario.rol !== 'admin') {
        throw errores.sinPermiso('Solo un administrador puede aprobar pagos fuera de plazo.');
      }
    }
    if (actual.contrato_tipo === 'sobrecarga') {
      const contrato = get('SELECT estado FROM contratos WHERE id = ?', actual.contrato_id);
      if (!contrato || contrato.estado === 'cancelado') {
        throw errores.regla('El contrato asociado está cancelado.');
      }
    }
  }

  const pagado = estado === 'pagado';
  const fecha = pagado ? fechaPago || hoyISO() : null;
  if (pagado) v.fecha(fecha, 'fechaPago');

  return transaccion(() => {
    run(
      `UPDATE pagos SET estado = ?, fecha_pago = ?, aprobado_por = ?, aprobado_en = ?
        WHERE id = ?`,
      estado,
      fecha,
      estado === 'aprobado' && !actual.aprobado_por ? usuario.id : actual.aprobado_por,
      estado === 'aprobado' && !actual.aprobado_en ? new Date().toISOString() : actual.aprobado_en,
      id,
    );
    return obtener(id);
  });
}

export function resumenPorEstado(periodo) {
  const params = [];
  let filtro = '';
  if (periodo) {
    filtro = 'WHERE periodo = ?';
    params.push(periodo);
  }
  return all(
    `SELECT estado, COUNT(*) AS cantidad, COALESCE(SUM(importe),0) AS importe
       FROM pagos ${filtro} GROUP BY estado`,
    ...params,
  ).map((f) => ({ estado: f.estado, cantidad: f.cantidad, importe: f.importe }));
}
