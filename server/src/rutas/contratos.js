import { all } from '../db.js';
import { errores } from '../lib/http.js';
import * as v from '../lib/validar.js';
import { autenticar } from '../lib/sesion.js';
import { registrarAuditoria } from '../lib/auditoria.js';
import {
  ESTADOS,
  TIPOS,
  actualizar,
  cambiarEstado,
  crear,
  eliminar,
  listar,
  obtener,
  serializar,
} from '../servicios/contratos.js';
import { pdfContrato, pdfContratos } from '../servicios/reportes.js';
import { configuracion } from '../servicios/configuracion.js';

export function registrarRutasContratos(app) {
  app.get('/api/contratos', (ctx) => {
    autenticar(ctx, { modulo: 'contratos', accion: 'leer' });
    const { page, limit, offset } = v.paginacion(ctx.query);
    const { items, total } = listar({
      q: ctx.query.q,
      estado: ctx.query.estado && ESTADOS.includes(ctx.query.estado) ? ctx.query.estado : null,
      tipo: ctx.query.tipo && TIPOS.includes(ctx.query.tipo) ? ctx.query.tipo : null,
      profesorId: ctx.query.profesorId ? v.id(ctx.query.profesorId, 'profesorId') : null,
      offset,
      limit,
    });
    ctx.json({ items, total, page, limit, paginas: Math.max(1, Math.ceil(total / limit)) });
  });

  app.get('/api/contratos/pdf', (ctx) => {
    autenticar(ctx, { modulo: 'contratos', accion: 'leer' });
    const estado = ctx.query.estado && ESTADOS.includes(ctx.query.estado) ? ctx.query.estado : null;
    const tipo = ctx.query.tipo && TIPOS.includes(ctx.query.tipo) ? ctx.query.tipo : null;
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
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const filas = all(
      `SELECT c.*, p.nombre AS profesor_nombre, p.no_trabajador, p.ci, p.categoria_docente
         FROM contratos c JOIN profesores p ON p.id = c.profesor_id
         ${where} ORDER BY c.codigo LIMIT 150`,
      ...params,
    );
    if (!filas.length) throw errores.noExiste('No hay contratos que cumplan el filtro.');
    const buffer = pdfContratos(filas.map(serializar), configuracion());
    registrarAuditoria(ctx, {
      accion: 'exportar_contratos_pdf',
      entidad: 'contratos',
      detalle: { registros: filas.length, estado, tipo },
    });
    ctx.enviar(buffer, 'application/pdf', 200, {
      'Content-Disposition': `attachment; filename="contratos-${new Date().toISOString().slice(0, 10)}.pdf"`,
      'Content-Length': String(buffer.length),
    });
  });

  app.get('/api/contratos/:id/pdf', (ctx) => {
    autenticar(ctx, { modulo: 'contratos', accion: 'leer' });
    const id = v.id(ctx.params.id);
    const contrato = obtener(id);
    const buffer = pdfContrato(contrato, configuracion());
    registrarAuditoria(ctx, {
      accion: 'exportar_contrato_pdf',
      entidad: 'contratos',
      entidadId: id,
    });
    ctx.enviar(buffer, 'application/pdf', 200, {
      'Content-Disposition': `attachment; filename="${contrato.codigo}.pdf"`,
      'Content-Length': String(buffer.length),
    });
  });

  app.get('/api/contratos/:id', (ctx) => {
    autenticar(ctx, { modulo: 'contratos', accion: 'leer' });
    const id = v.id(ctx.params.id);
    ctx.json({ contrato: obtener(id) });
  });

  app.post('/api/contratos', (ctx) => {
    const usuario = autenticar(ctx, { modulo: 'contratos', accion: 'crear' });
    const contrato = crear(ctx.cuerpo, usuario);
    registrarAuditoria(ctx, {
      accion: 'contrato_creado',
      entidad: 'contratos',
      entidadId: contrato.id,
      detalle: { codigo: contrato.codigo, profesor: contrato.profesor, importe: contrato.importe },
    });
    ctx.json({ contrato }, 201);
  });

  app.patch('/api/contratos/:id', (ctx) => {
    const usuario = autenticar(ctx, { modulo: 'contratos', accion: 'actualizar' });
    const id = v.id(ctx.params.id);
    const contrato = actualizar(id, ctx.cuerpo);
    registrarAuditoria(ctx, {
      accion: 'contrato_actualizado',
      entidad: 'contratos',
      entidadId: id,
      detalle: { codigo: contrato.codigo, usuario: usuario.email },
    });
    ctx.json({ contrato });
  });

  app.post('/api/contratos/:id/estado', (ctx) => {
    const usuario = autenticar(ctx, { modulo: 'contratos', accion: 'actualizar' });
    const id = v.id(ctx.params.id);
    const estado = v.enumerado(ctx.cuerpo.estado, 'estado', ESTADOS);
    const motivo = ctx.cuerpo.motivo ? v.texto(ctx.cuerpo.motivo, 'motivo', { max: 500 }) : null;
    const contrato = cambiarEstado(id, estado, usuario, motivo);
    registrarAuditoria(ctx, {
      accion: 'contrato_estado',
      entidad: 'contratos',
      entidadId: id,
      detalle: { a: estado, motivo },
    });
    ctx.json({ contrato });
  });

  app.delete('/api/contratos/:id', (ctx) => {
    const usuario = autenticar(ctx, { modulo: 'contratos', accion: 'eliminar' });
    if (usuario.rol !== 'admin') throw errores.sinPermiso('Solo un administrador puede eliminar contratos.');
    const id = v.id(ctx.params.id);
    eliminar(id);
    registrarAuditoria(ctx, { accion: 'contrato_eliminado', entidad: 'contratos', entidadId: id });
    ctx.sinContenido(204);
  });
}
