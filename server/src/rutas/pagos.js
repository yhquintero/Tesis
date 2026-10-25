import { all, get } from '../db.js';
import { errores } from '../lib/http.js';
import * as v from '../lib/validar.js';
import { autenticar } from '../lib/sesion.js';
import { registrarAuditoria } from '../lib/auditoria.js';
import { ESTADOS_PAGO, cambiarEstado, crear, listar, obtener } from '../servicios/pagos.js';
import { pdfPagos, xlsxPagos } from '../servicios/reportes.js';
import { configuracion } from '../servicios/configuracion.js';

export function registrarRutasPagos(app) {
  app.get('/api/pagos', (ctx) => {
    autenticar(ctx, { modulo: 'pagos', accion: 'leer' });
    const { page, limit, offset } = v.paginacion(ctx.query);
    const { items, total } = listar({
      estado: ctx.query.estado && ESTADOS_PAGO.includes(ctx.query.estado) ? ctx.query.estado : null,
      periodo: ctx.query.periodo || null,
      contratoId: ctx.query.contratoId ? v.id(ctx.query.contratoId, 'contratoId') : null,
      q: ctx.query.q,
      offset,
      limit,
    });
    ctx.json({ items, total, page, limit, paginas: Math.max(1, Math.ceil(total / limit)) });
  });

  app.get('/api/pagos/export.xlsx', (ctx) => {
    autenticar(ctx, { modulo: 'pagos', accion: 'leer' });
    const estado = ctx.query.estado && ESTADOS_PAGO.includes(ctx.query.estado) ? ctx.query.estado : null;
    const periodo = ctx.query.periodo || null;
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
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const filas = all(
      `SELECT pg.*, c.codigo AS contrato_codigo, c.tipo AS contrato_tipo, p.nombre AS profesor_nombre
         FROM pagos pg JOIN contratos c ON c.id = pg.contrato_id
         JOIN profesores p ON p.id = c.profesor_id
         ${where} ORDER BY pg.periodo DESC, pg.id DESC`,
      ...params,
    );
    const buffer = xlsxPagos(
      filas.map((f) => ({
        contrato: f.contrato_codigo,
        profesor: f.profesor_nombre,
        periodo: f.periodo,
        horas: f.horas,
        tarifa: f.tarifa,
        importe: f.importe,
        estado: f.estado,
        fechaLimite: f.fecha_limite,
        fechaPago: f.fecha_pago,
        vencido: f.fecha_limite < new Date().toISOString().slice(0, 10) && f.estado !== 'pagado',
      })),
      configuracion(),
      { periodo: periodo || '' },
    );
    registrarAuditoria(ctx, { accion: 'exportar_pagos', entidad: 'pagos', detalle: { registros: filas.length } });
    ctx.enviar(
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      200,
      {
        'Content-Disposition': `attachment; filename="pagos-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        'Content-Length': String(buffer.length),
      },
    );
  });

  app.get('/api/pagos/pdf', (ctx) => {
    autenticar(ctx, { modulo: 'pagos', accion: 'leer' });
    const estado = ctx.query.estado && ESTADOS_PAGO.includes(ctx.query.estado) ? ctx.query.estado : null;
    const periodo = ctx.query.periodo || null;
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
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const filas = all(
      `SELECT pg.*, c.codigo AS contrato_codigo, p.nombre AS profesor_nombre
         FROM pagos pg JOIN contratos c ON c.id = pg.contrato_id
         JOIN profesores p ON p.id = c.profesor_id
         ${where} ORDER BY pg.periodo DESC, pg.id DESC`,
      ...params,
    );
    if (!filas.length) throw errores.noExiste('No hay pagos que cumplan el filtro.');
    const buffer = pdfPagos(
      filas.map((f) => ({
        contrato: f.contrato_codigo,
        profesor: f.profesor_nombre,
        periodo: f.periodo,
        horas: f.horas,
        importe: f.importe,
        estado: f.estado,
        fechaLimite: f.fecha_limite,
      })),
      configuracion(),
      { periodo: periodo || '' },
    );
    ctx.enviar(buffer, 'application/pdf', 200, {
      'Content-Disposition': `attachment; filename="reporte-pagos-${new Date().toISOString().slice(0, 10)}.pdf"`,
      'Content-Length': String(buffer.length),
    });
  });

  app.post('/api/pagos', (ctx) => {
    const usuario = autenticar(ctx, { modulo: 'pagos', accion: 'crear' });
    const pago = crear(ctx.cuerpo, usuario);
    registrarAuditoria(ctx, {
      accion: 'pago_creado',
      entidad: 'pagos',
      entidadId: pago.id,
      detalle: { contrato: pago.contrato, periodo: pago.periodo, importe: pago.importe },
    });
    ctx.json({ pago }, 201);
  });

  app.post('/api/pagos/:id/estado', (ctx) => {
    const usuario = autenticar(ctx, { modulo: 'pagos', accion: 'actualizar' });
    const id = v.id(ctx.params.id);
    const estado = v.enumerado(ctx.cuerpo.estado, 'estado', ESTADOS_PAGO);
    const forzar = v.booleano(ctx.cuerpo.forzar, 'forzar', { porDefecto: false });
    const fechaPago = ctx.cuerpo.fechaPago ? v.fecha(ctx.cuerpo.fechaPago, 'fechaPago') : null;
    const pago = cambiarEstado(id, estado, usuario, { fechaPago, forzar });
    registrarAuditoria(ctx, {
      accion: 'pago_estado',
      entidad: 'pagos',
      entidadId: id,
      detalle: { a: estado, forzar, fechaPago },
    });
    ctx.json({ pago });
  });

  app.get('/api/pagos/resumen', (ctx) => {
    autenticar(ctx, { modulo: 'pagos', accion: 'leer' });
    const filas = all(
      `SELECT estado, COUNT(*) AS cantidad, COALESCE(SUM(importe),0) AS importe
         FROM pagos GROUP BY estado`,
    );
    ctx.json({ resumen: filas });
  });

  app.get('/api/pagos/periodos', (ctx) => {
    autenticar(ctx, { modulo: 'pagos', accion: 'leer' });
    const filas = all('SELECT DISTINCT periodo FROM pagos ORDER BY periodo DESC');
    ctx.json({ periodos: filas.map((f) => f.periodo) });
  });

  app.get('/api/pagos/contratos-disponibles', (ctx) => {
    autenticar(ctx, { modulo: 'pagos', accion: 'leer' });
    const filas = all(
      `SELECT c.id, c.codigo, c.horas, c.tarifa_hora, p.nombre AS profesor
         FROM contratos c JOIN profesores p ON p.id = c.profesor_id
        WHERE c.estado IN ('activo','completado')
        ORDER BY c.codigo DESC LIMIT 200`,
    );
    ctx.json({ contratos: filas });
  });

  app.get('/api/pagos/:id', (ctx) => {
    autenticar(ctx, { modulo: 'pagos', accion: 'leer' });
    ctx.json({ pago: obtener(v.id(ctx.params.id)) });
  });
}
