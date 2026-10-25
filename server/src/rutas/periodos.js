import { all, get, run } from '../db.js';
import { errores } from '../lib/http.js';
import * as v from '../lib/validar.js';
import { autenticar, soloAdmin } from '../lib/sesion.js';
import { registrarAuditoria } from '../lib/auditoria.js';
import { calcular, generarContratos, guardarHoras, obtenerPeriodo } from '../servicios/prenomina.js';
import { xlsxPrenomina } from '../servicios/reportes.js';
import { configuracion } from '../servicios/configuracion.js';

export function registrarRutasPeriodos(app) {
  app.get('/api/periodos', (ctx) => {
    autenticar(ctx, { modulo: 'periodos', accion: 'leer' });
    const items = all('SELECT * FROM periodos ORDER BY inicio DESC').map((p) => ({
      id: p.id,
      nombre: p.nombre,
      inicio: p.inicio,
      fin: p.fin,
      cortes: p.cortes,
      estado: p.estado,
      creadoEn: p.creado_en,
    }));
    ctx.json({ items });
  });

  app.post('/api/periodos', (ctx) => {
    const admin = soloAdmin(ctx);
    const nombre = v.texto(ctx.cuerpo.nombre, 'nombre', { min: 4, max: 20 });
    const inicio = v.fecha(ctx.cuerpo.inicio, 'inicio');
    const fin = v.fecha(ctx.cuerpo.fin, 'fin');
    if (fin <= inicio) {
      throw errores.validacion('La fecha de fin debe ser posterior a la de inicio.', { fin: 'Rango inválido.' });
    }
    const cortes = v.entero(ctx.cuerpo.cortes ?? 14, 'cortes', { min: 1, max: 26 });
    if (get('SELECT id FROM periodos WHERE nombre = ?', nombre)) {
      throw errores.conflicto('Ya existe un período con ese nombre.');
    }
    const resultado = run(
      'INSERT INTO periodos (nombre, inicio, fin, cortes, estado) VALUES (?, ?, ?, ?, ?)',
      nombre,
      inicio,
      fin,
      cortes,
      'abierto',
    );
    const creado = get('SELECT * FROM periodos WHERE id = ?', Number(resultado.lastInsertRowid));
    registrarAuditoria(ctx, {
      accion: 'periodo_creado',
      entidad: 'periodos',
      entidadId: creado.id,
      detalle: { nombre },
    });
    ctx.json({ periodo: creado }, 201);
  });

  app.patch('/api/periodos/:id', (ctx) => {
    soloAdmin(ctx);
    const id = v.id(ctx.params.id);
    const periodo = get('SELECT * FROM periodos WHERE id = ?', id);
    if (!periodo) throw errores.noExiste('El período no existe.');
    const estado = v.enumerado(ctx.cuerpo.estado, 'estado', ['abierto', 'cerrado']);
    run('UPDATE periodos SET estado = ? WHERE id = ?', estado, id);
    registrarAuditoria(ctx, {
      accion: 'periodo_estado',
      entidad: 'periodos',
      entidadId: id,
      detalle: { estado },
    });
    ctx.json({ periodo: { ...periodo, estado } });
  });

  app.get('/api/prenomina', (ctx) => {
    autenticar(ctx, { modulo: 'prenomina', accion: 'leer' });
    const periodoId = ctx.query.periodoId ? v.id(ctx.query.periodoId, 'periodoId') : null;
    ctx.json(calcular(periodoId));
  });

  app.put('/api/prenomina/horas', (ctx) => {
    const usuario = autenticar(ctx, { modulo: 'prenomina', accion: 'actualizar' });
    const periodoId = v.id(ctx.cuerpo.periodoId, 'periodoId');
    const profesorId = v.id(ctx.cuerpo.profesorId, 'profesorId');
    const datos = guardarHoras(periodoId, profesorId, ctx.cuerpo.horas);
    registrarAuditoria(ctx, {
      accion: 'prenomina_horas',
      entidad: 'profesores',
      entidadId: profesorId,
      detalle: { periodoId, usuario: usuario.email },
    });
    ctx.json(datos);
  });

  app.post('/api/prenomina/generar-contratos', (ctx) => {
    const usuario = autenticar(ctx, { modulo: 'contratos', accion: 'crear' });
    const periodoId = v.id(ctx.cuerpo.periodoId, 'periodoId');
    const resultado = generarContratos(periodoId, usuario);
    registrarAuditoria(ctx, {
      accion: 'prenomina_generar_contratos',
      entidad: 'periodos',
      entidadId: periodoId,
      detalle: { creados: resultado.creados },
    });
    ctx.json(resultado, 201);
  });

  app.get('/api/prenomina/export.xlsx', (ctx) => {
    autenticar(ctx, { modulo: 'prenomina', accion: 'leer' });
    const periodoId = ctx.query.periodoId ? v.id(ctx.query.periodoId, 'periodoId') : null;
    const datos = calcular(periodoId);
    const buffer = xlsxPrenomina(datos, configuracion());
    registrarAuditoria(ctx, {
      accion: 'exportar_prenomina',
      entidad: 'periodos',
      entidadId: datos.periodo.id,
      detalle: { profesores: datos.profesores.length },
    });
    ctx.enviar(
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      200,
      {
        'Content-Disposition': `attachment; filename="prenomina-${datos.periodo.nombre}.xlsx"`,
        'Content-Length': String(buffer.length),
      },
    );
  });

  app.get('/api/periodos/actual', (ctx) => {
    autenticar(ctx, { modulo: 'periodos', accion: 'leer' });
    const periodo = obtenerPeriodo();
    ctx.json({ periodo });
  });
}
