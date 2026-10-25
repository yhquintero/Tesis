import { run } from '../db.js';

export function registrarAuditoria(ctx, { accion, entidad = null, entidadId = null, detalle = null }) {
  const usuario = ctx?.usuario || null;
  const textoDetalle =
    detalle === null || detalle === undefined
      ? null
      : typeof detalle === 'string'
        ? detalle.slice(0, 4000)
        : JSON.stringify(detalle).slice(0, 4000);
  run(
    `INSERT INTO auditoria (usuario_id, email, accion, entidad, entidad_id, detalle, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    usuario?.id ?? null,
    usuario?.email ?? null,
    String(accion).slice(0, 80),
    entidad,
    entidadId === null ? null : String(entidadId),
    textoDetalle,
    ctx?.ip ? String(ctx.ip).slice(0, 100) : null,
    ctx?.userAgent ? String(ctx.userAgent).slice(0, 300) : null,
  );
}

export function listarAuditoria({ accion, desde, hasta, offset, limit }) {
  const condiciones = [];
  const params = [];
  if (accion) {
    condiciones.push('accion LIKE ?');
    params.push(`%${accion}%`);
  }
  if (desde) {
    condiciones.push('creado_en >= ?');
    params.push(`${desde}T00:00:00.000Z`);
  }
  if (hasta) {
    condiciones.push('creado_en <= ?');
    params.push(`${hasta}T23:59:59.999Z`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  return { where, params };
}
