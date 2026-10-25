import { readFileSync } from 'node:fs';
import { all, get } from '../db.js';
import { errores } from '../lib/http.js';
import * as v from '../lib/validar.js';
import { autenticar, soloAdmin } from '../lib/sesion.js';
import { registrarAuditoria } from '../lib/auditoria.js';
import { construirDashboard } from '../servicios/dashboard.js';
import { CATEGORIAS_DOCENTES, listarTarifas, matrizTarifas } from '../servicios/tarifas.js';
import { configuracion, guardarConfiguracion, VALORES_POR_DEFECTO } from '../servicios/configuracion.js';
import { run } from '../db.js';
import {
  crearRespaldo,
  listarRespaldos,
  restaurarRespaldo,
  rutaRespaldo,
} from '../servicios/respaldos.js';
import { version } from '../servicios/version.js';

export function registrarRutasSistema(app) {
  app.get(
    '/api/salud',
    (ctx) => {
      let db = 'ok';
      try {
        get('SELECT 1 AS n');
      } catch {
        db = 'error';
      }
      ctx.json({ ok: db === 'ok', version, hora: new Date().toISOString(), baseDatos: db });
    },
    { publica: true },
  );

  app.get('/api/version', (ctx) => {
    ctx.json({ version, esquema: 1 });
  });

  app.get('/api/dashboard', (ctx) => {
    autenticar(ctx, { modulo: 'dashboard', accion: 'leer' });
    ctx.json(construirDashboard());
  });

  app.get('/api/catalogos', (ctx) => {
    autenticar(ctx);
    ctx.json({
      roles: [
        { valor: 'admin', etiqueta: 'Administrador' },
        { valor: 'determinado', etiqueta: 'Determinado' },
        { valor: 'sobrecarga', etiqueta: 'Sobrecarga' },
      ],
      estadosUsuario: ['pendiente', 'aprobado', 'rechazado', 'inactivo'],
      estadosContrato: ['borrador', 'pendiente', 'aprobado', 'activo', 'completado', 'rechazado', 'cancelado'],
      estadosPago: ['pendiente', 'aprobado', 'pagado', 'anulado'],
      tiposContrato: ['determinado', 'sobrecarga'],
      categoriasDocentes: CATEGORIAS_DOCENTES,
      categoriasPoc: ['Profesor', 'Cuadros'],
      permisos: ['crear', 'leer', 'actualizar', 'eliminar'],
      moneda: configuracion().moneda,
      simboloMoneda: configuracion().simbolo_moneda,
    });
  });

  app.get('/api/tarifas', (ctx) => {
    autenticar(ctx, { modulo: 'tarifas', accion: 'leer' });
    ctx.json({ tarifas: listarTarifas(), matriz: matrizTarifas() });
  });

  app.post('/api/tarifas', (ctx) => {
    soloAdmin(ctx);
    const categoriaDocente = v.enumerado(ctx.cuerpo.categoriaDocente, 'categoriaDocente', CATEGORIAS_DOCENTES);
    const tipo = v.enumerado(ctx.cuerpo.tipo, 'tipo', ['determinado', 'sobrecarga']);
    const importe = v.numero(ctx.cuerpo.importe, 'importe', { min: 0.01, max: 100000 });
    const vigenteDesde = v.fecha(ctx.cuerpo.vigenteDesde ?? new Date().toISOString().slice(0, 10), 'vigenteDesde');
    const existente = get(
      'SELECT id FROM tarifas WHERE categoria_docente = ? AND tipo = ? AND vigente_desde = ?',
      categoriaDocente,
      tipo,
      vigenteDesde,
    );
    if (existente) {
      run('UPDATE tarifas SET importe = ? WHERE id = ?', importe, existente.id);
    } else {
      run(
        'INSERT INTO tarifas (categoria_docente, tipo, importe, vigente_desde) VALUES (?, ?, ?, ?)',
        categoriaDocente,
        tipo,
        importe,
        vigenteDesde,
      );
    }
    registrarAuditoria(ctx, {
      accion: 'tarifa_guardada',
      entidad: 'tarifas',
      detalle: { categoriaDocente, tipo, importe, vigenteDesde },
    });
    ctx.json({ tarifas: listarTarifas(), matriz: matrizTarifas() }, existente ? 200 : 201);
  });

  app.get('/api/configuracion', (ctx) => {
    autenticar(ctx, { modulo: 'configuracion', accion: 'leer' });
    ctx.json({ configuracion: configuracion() });
  });

  app.put('/api/configuracion', (ctx) => {
    soloAdmin(ctx);
    const cambios = ctx.cuerpo || {};
    for (const [clave, valor] of Object.entries(cambios)) {
      if (!(clave in VALORES_POR_DEFECTO)) {
        throw errores.validacion(`Parámetro desconocido: ${clave}`);
      }
      if (typeof valor === 'object' || String(valor).length > 300) {
        throw errores.validacion(`Valor inválido para ${clave}.`);
      }
    }
    const resultado = guardarConfiguracion(cambios);
    registrarAuditoria(ctx, {
      accion: 'configuracion_actualizada',
      entidad: 'configuracion',
      detalle: cambios,
    });
    ctx.json({ configuracion: resultado });
  });

  app.get('/api/auditoria', (ctx) => {
    soloAdmin(ctx);
    const { page, limit, offset } = v.paginacion(ctx.query);
    const condiciones = [];
    const params = [];
    if (ctx.query.accion) {
      condiciones.push('accion LIKE ?');
      params.push(`%${ctx.query.accion}%`);
    }
    if (ctx.query.desde) {
      condiciones.push('creado_en >= ?');
      params.push(`${ctx.query.desde}T00:00:00.000Z`);
    }
    if (ctx.query.hasta) {
      condiciones.push('creado_en <= ?');
      params.push(`${ctx.query.hasta}T23:59:59.999Z`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const total = get(`SELECT COUNT(*) AS n FROM auditoria ${where}`, ...params).n;
    const items = all(
      `SELECT * FROM auditoria ${where} ORDER BY creado_en DESC, id DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset,
    ).map((f) => ({
      id: f.id,
      usuario: f.email,
      accion: f.accion,
      entidad: f.entidad,
      entidadId: f.entidad_id,
      detalle: f.detalle,
      ip: f.ip,
      creadoEn: f.creado_en,
    }));
    ctx.json({ items, total, page, limit, paginas: Math.max(1, Math.ceil(total / limit)) });
  });

  app.get('/api/respaldos', (ctx) => {
    soloAdmin(ctx);
    ctx.json({ respaldos: listarRespaldos() });
  });

  app.post('/api/respaldos', (ctx) => {
    soloAdmin(ctx);
    const respaldo = crearRespaldo('manual');
    registrarAuditoria(ctx, {
      accion: 'respaldo_creado',
      entidad: 'respaldos',
      entidadId: respaldo.id,
      detalle: { archivo: respaldo.archivo, bytes: respaldo.bytes },
    });
    ctx.json({ respaldo }, 201);
  });

  app.get('/api/respaldos/:id/descargar', (ctx) => {
    soloAdmin(ctx);
    const { ruta, fila } = rutaRespaldo(v.id(ctx.params.id));
    const buffer = readFileSync(ruta);
    ctx.enviar(buffer, 'application/x-sqlite3', 200, {
      'Content-Disposition': `attachment; filename="${fila.archivo}"`,
      'Content-Length': String(buffer.length),
    });
  });

  app.post('/api/respaldos/:id/restaurar', (ctx) => {
    const admin = soloAdmin(ctx);
    const id = v.id(ctx.params.id);
    const resultado = restaurarRespaldo(id);
    registrarAuditoria(
      { ...ctx, usuario: admin },
      { accion: 'respaldo_restaurado', entidad: 'respaldos', entidadId: id },
    );
    ctx.json({ ...resultado, reautenticar: true });
  });
}
