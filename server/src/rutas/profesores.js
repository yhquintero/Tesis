import { all, get, run } from '../db.js';
import { errores } from '../lib/http.js';
import * as v from '../lib/validar.js';
import { autenticar } from '../lib/sesion.js';
import { registrarAuditoria } from '../lib/auditoria.js';
import { CATEGORIAS_DOCENTES } from '../servicios/tarifas.js';
import { xlsxProfesores } from '../servicios/reportes.js';
import { configuracion } from '../servicios/configuracion.js';

const CATEGORIAS_POC = ['Profesor', 'Cuadros'];

export function serializarProfesor(fila) {
  return {
    id: fila.id,
    noTrabajador: fila.no_trabajador,
    nombre: fila.nombre,
    ci: fila.ci,
    anio: fila.anio,
    area: fila.area,
    areaCiencia: fila.area_ciencia,
    categoriaPoc: fila.categoria_poc,
    categoriaDocente: fila.categoria_docente,
    cargaHoraria: fila.carga_horaria,
    correo: fila.correo,
    telefono: fila.telefono,
    activo: Boolean(fila.activo),
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
    contratos: fila.contratos ?? undefined,
    horasPeriodo: fila.horas_periodo ?? undefined,
  };
}

function validarProfesor(datos, actual = null) {
  const a = actual || {};
  const salida = {};
  salida.noTrabajador = datos.noTrabajador !== undefined
    ? v.texto(datos.noTrabajador, 'noTrabajador', { min: 1, max: 30 })
    : a.no_trabajador;
  salida.nombre = datos.nombre !== undefined
    ? v.texto(datos.nombre, 'nombre', { min: 3, max: 120 })
    : a.nombre;
  salida.ci = datos.ci !== undefined ? v.texto(datos.ci, 'ci', { min: 6, max: 20 }) : a.ci;
  if (!salida.ci || !/^\d{6,20}$/.test(salida.ci)) {
    throw errores.validacion('El carné de identidad debe contener solo dígitos (6 a 20).', {
      ci: 'Formato de CI no válido.',
    });
  }
  salida.anio = datos.anio !== undefined ? v.texto(datos.anio, 'anio', { max: 40, requerido: false }) : a.anio ?? null;
  salida.area = datos.area !== undefined
    ? v.texto(datos.area, 'area', { max: 120, requerido: false })
    : a.area ?? 'Facultad de Ciencias Técnicas';
  salida.areaCiencia = datos.areaCiencia !== undefined
    ? v.texto(datos.areaCiencia, 'areaCiencia', { max: 120, requerido: false })
    : a.area_ciencia ?? 'Ingeniería en Informática';
  salida.categoriaPoc = datos.categoriaPoc !== undefined
    ? v.enumerado(datos.categoriaPoc, 'categoriaPoc', CATEGORIAS_POC)
    : a.categoria_poc ?? 'Profesor';
  salida.categoriaDocente = datos.categoriaDocente !== undefined
    ? v.enumerado(datos.categoriaDocente, 'categoriaDocente', CATEGORIAS_DOCENTES)
    : a.categoria_docente;
  salida.cargaHoraria = datos.cargaHoraria !== undefined
    ? v.numero(datos.cargaHoraria, 'cargaHoraria', { min: 0, max: 60 })
    : a.carga_horaria ?? 8;
  salida.correo = datos.correo !== undefined
    ? v.email(datos.correo, 'correo', { requerido: false })
    : a.correo ?? null;
  salida.telefono = datos.telefono !== undefined
    ? v.texto(datos.telefono, 'telefono', { max: 30, requerido: false })
    : a.telefono ?? null;
  salida.activo = datos.activo !== undefined
    ? v.booleano(datos.activo, 'activo', { porDefecto: true })
    : a.activo === undefined
      ? true
      : Boolean(a.activo);
  return salida;
}

export function registrarRutasProfesores(app) {
  app.get('/api/profesores', (ctx) => {
    autenticar(ctx, { modulo: 'profesores', accion: 'leer' });
    const { page, limit, offset } = v.paginacion(ctx.query);
    const condiciones = [];
    const params = [];
    if (ctx.query.q) {
      condiciones.push('(nombre LIKE ? OR ci LIKE ? OR no_trabajador LIKE ? OR correo LIKE ?)');
      const like = `%${ctx.query.q}%`;
      params.push(like, like, like, like);
    }
    if (ctx.query.categoria) {
      condiciones.push('categoria_docente = ?');
      params.push(ctx.query.categoria);
    }
    if (ctx.query.activo !== undefined && ctx.query.activo !== '') {
      condiciones.push('activo = ?');
      params.push(ctx.query.activo === 'true' || ctx.query.activo === '1' ? 1 : 0);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const total = get(`SELECT COUNT(*) AS n FROM profesores ${where}`, ...params).n;
    const filas = all(
      `SELECT * FROM profesores ${where} ORDER BY nombre COLLATE NOCASE LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset,
    );
    ctx.json({
      items: filas.map(serializarProfesor),
      total,
      page,
      limit,
      paginas: Math.max(1, Math.ceil(total / limit)),
    });
  });

  app.get('/api/profesores/export.xlsx', (ctx) => {
    autenticar(ctx, { modulo: 'profesores', accion: 'leer' });
    const condiciones = [];
    const params = [];
    if (ctx.query.q) {
      condiciones.push('(nombre LIKE ? OR ci LIKE ? OR no_trabajador LIKE ?)');
      const like = `%${ctx.query.q}%`;
      params.push(like, like, like);
    }
    if (ctx.query.categoria) {
      condiciones.push('categoria_docente = ?');
      params.push(ctx.query.categoria);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const filas = all(`SELECT * FROM profesores ${where} ORDER BY nombre COLLATE NOCASE`, ...params);
    const buffer = xlsxProfesores(filas.map(serializarProfesor), configuracion());
    registrarAuditoria(ctx, {
      accion: 'exportar_profesores',
      entidad: 'profesores',
      detalle: { registros: filas.length },
    });
    ctx.enviar(
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      200,
      {
        'Content-Disposition': `attachment; filename="profesores-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        'Content-Length': String(buffer.length),
      },
    );
  });

  app.get('/api/profesores/:id', (ctx) => {
    autenticar(ctx, { modulo: 'profesores', accion: 'leer' });
    const id = v.id(ctx.params.id);
    const fila = get('SELECT * FROM profesores WHERE id = ?', id);
    if (!fila) throw errores.noExiste('El profesor no existe.');
    const contratos = get('SELECT COUNT(*) AS n FROM contratos WHERE profesor_id = ?', id).n;
    ctx.json({ profesor: serializarProfesor({ ...fila, contratos }) });
  });

  app.post('/api/profesores', (ctx) => {
    autenticar(ctx, { modulo: 'profesores', accion: 'crear' });
    const datos = validarProfesor(ctx.cuerpo);
    if (get('SELECT id FROM profesores WHERE no_trabajador = ?', datos.noTrabajador)) {
      throw errores.conflicto('Ya existe un profesor con ese número de trabajador.');
    }
    if (get('SELECT id FROM profesores WHERE ci = ?', datos.ci)) {
      throw errores.conflicto('Ya existe un profesor con ese carné de identidad.');
    }
    const resultado = run(
      `INSERT INTO profesores
        (no_trabajador, nombre, ci, anio, area, area_ciencia, categoria_poc, categoria_docente,
         carga_horaria, correo, telefono, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      datos.noTrabajador,
      datos.nombre,
      datos.ci,
      datos.anio,
      datos.area || 'Facultad de Ciencias Técnicas',
      datos.areaCiencia || 'Ingeniería en Informática',
      datos.categoriaPoc,
      datos.categoriaDocente,
      datos.cargaHoraria,
      datos.correo,
      datos.telefono,
      datos.activo ? 1 : 0,
    );
    const creado = get('SELECT * FROM profesores WHERE id = ?', Number(resultado.lastInsertRowid));
    registrarAuditoria(ctx, {
      accion: 'profesor_creado',
      entidad: 'profesores',
      entidadId: creado.id,
      detalle: { nombre: creado.nombre },
    });
    ctx.json({ profesor: serializarProfesor(creado) }, 201);
  });

  app.patch('/api/profesores/:id', (ctx) => {
    autenticar(ctx, { modulo: 'profesores', accion: 'actualizar' });
    const id = v.id(ctx.params.id);
    const actual = get('SELECT * FROM profesores WHERE id = ?', id);
    if (!actual) throw errores.noExiste('El profesor no existe.');
    const datos = validarProfesor(ctx.cuerpo, actual);
    if (datos.noTrabajador !== actual.no_trabajador) {
      const otro = get('SELECT id FROM profesores WHERE no_trabajador = ? AND id <> ?', datos.noTrabajador, id);
      if (otro) throw errores.conflicto('Ese número de trabajador ya está registrado.');
    }
    if (datos.ci !== actual.ci) {
      const otro = get('SELECT id FROM profesores WHERE ci = ? AND id <> ?', datos.ci, id);
      if (otro) throw errores.conflicto('Ese carné de identidad ya está registrado.');
    }
    run(
      `UPDATE profesores SET no_trabajador = ?, nombre = ?, ci = ?, anio = ?, area = ?,
         area_ciencia = ?, categoria_poc = ?, categoria_docente = ?, carga_horaria = ?,
         correo = ?, telefono = ?, activo = ?, actualizado_en = ?
       WHERE id = ?`,
      datos.noTrabajador,
      datos.nombre,
      datos.ci,
      datos.anio,
      datos.area || 'Facultad de Ciencias Técnicas',
      datos.areaCiencia || 'Ingeniería en Informática',
      datos.categoriaPoc,
      datos.categoriaDocente,
      datos.cargaHoraria,
      datos.correo,
      datos.telefono,
      datos.activo ? 1 : 0,
      new Date().toISOString(),
      id,
    );
    const actualizado = get('SELECT * FROM profesores WHERE id = ?', id);
    registrarAuditoria(ctx, {
      accion: 'profesor_actualizado',
      entidad: 'profesores',
      entidadId: id,
      detalle: { nombre: datos.nombre },
    });
    ctx.json({ profesor: serializarProfesor(actualizado) });
  });

  app.delete('/api/profesores/:id', (ctx) => {
    autenticar(ctx, { modulo: 'profesores', accion: 'eliminar' });
    const id = v.id(ctx.params.id);
    const profesor = get('SELECT * FROM profesores WHERE id = ?', id);
    if (!profesor) throw errores.noExiste('El profesor no existe.');
    const contratos = get('SELECT COUNT(*) AS n FROM contratos WHERE profesor_id = ?', id).n;
    if (contratos > 0) {
      throw errores.conflicto(
        `No puede eliminar al profesor porque tiene ${contratos} contrato(s) asociado(s). Desactívelo en su lugar.`,
      );
    }
    run('DELETE FROM profesores WHERE id = ?', id);
    registrarAuditoria(ctx, {
      accion: 'profesor_eliminado',
      entidad: 'profesores',
      entidadId: id,
      detalle: { nombre: profesor.nombre },
    });
    ctx.sinContenido(204);
  });
}
