import { all, get, run } from '../db.js';
import { hashPassword, passwordTemporal, validarPoliticaPassword } from '../auth.js';
import { errores } from '../lib/http.js';
import * as v from '../lib/validar.js';
import { autenticar, sanitizarUsuario, soloAdmin } from '../lib/sesion.js';
import { registrarAuditoria } from '../lib/auditoria.js';

const ROLES = ['admin', 'determinado', 'sobrecarga'];
const ESTADOS = ['pendiente', 'aprobado', 'rechazado', 'inactivo'];

function contarAdmins() {
  return get("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND estado = 'aprobado'").n;
}

function serializar(fila) {
  return {
    ...sanitizarUsuario(fila),
    contratos: fila.contratos ?? undefined,
  };
}

export function registrarRutasUsuarios(app) {
  app.get('/api/usuarios', (ctx) => {
    autenticar(ctx, { modulo: 'usuarios', accion: 'leer' });
    const { page, limit, offset } = v.paginacion(ctx.query);
    const condiciones = [];
    const params = [];
    if (ctx.query.q) {
      condiciones.push('(email LIKE ? OR nombre LIKE ?)');
      params.push(`%${ctx.query.q}%`, `%${ctx.query.q}%`);
    }
    if (ctx.query.rol) {
      condiciones.push('rol = ?');
      params.push(ctx.query.rol);
    }
    if (ctx.query.estado) {
      condiciones.push('estado = ?');
      params.push(ctx.query.estado);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const total = get(`SELECT COUNT(*) AS n FROM usuarios ${where}`, ...params).n;
    const filas = all(
      `SELECT * FROM usuarios ${where} ORDER BY creado_en DESC, id DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset,
    );
    ctx.json({
      items: filas.map(serializar),
      total,
      page,
      limit,
      paginas: Math.max(1, Math.ceil(total / limit)),
    });
  });

  app.post('/api/usuarios', (ctx) => {
    const admin = soloAdmin(ctx);
    const email = v.email(ctx.cuerpo.email);
    const nombre = v.texto(ctx.cuerpo.nombre, 'nombre', { min: 3, max: 120 });
    const rol = v.enumerado(ctx.cuerpo.rol, 'rol', ROLES);
    const estado = v.enumerado(ctx.cuerpo.estado ?? 'aprobado', 'estado', ESTADOS);
    const permisos = v.permisos(ctx.cuerpo.permisos);
    const claveDada = typeof ctx.cuerpo.password === 'string' ? ctx.cuerpo.password : '';
    const clave = claveDada || passwordTemporal();
    if (claveDada) {
      const erroresClave = validarPoliticaPassword(claveDada);
      if (erroresClave.length) throw errores.validacion(erroresClave[0], { password: erroresClave[0] });
    }
    if (get('SELECT id FROM usuarios WHERE email = ?', email)) {
      throw errores.conflicto('Ya existe una cuenta con ese correo electrónico.');
    }
    const resultado = run(
      `INSERT INTO usuarios (email, nombre, password_hash, rol, estado, permisos, debe_cambiar_clave)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      email,
      nombre,
      hashPassword(clave),
      rol,
      estado,
      JSON.stringify(permisos),
    );
    const creado = get('SELECT * FROM usuarios WHERE id = ?', Number(resultado.lastInsertRowid));
    registrarAuditoria(ctx, {
      accion: 'usuario_creado',
      entidad: 'usuarios',
      entidadId: creado.id,
      detalle: { email, rol, estado },
    });
    ctx.json({ usuario: serializar(creado), passwordTemporal: claveDada ? undefined : clave }, 201);
  });

  app.patch('/api/usuarios/:id', (ctx) => {
    const admin = soloAdmin(ctx);
    const id = v.id(ctx.params.id);
    const actual = get('SELECT * FROM usuarios WHERE id = ?', id);
    if (!actual) throw errores.noExiste('El usuario no existe.');

    const nombre = ctx.cuerpo.nombre !== undefined ? v.texto(ctx.cuerpo.nombre, 'nombre', { min: 3, max: 120 }) : actual.nombre;
    const rol = ctx.cuerpo.rol !== undefined ? v.enumerado(ctx.cuerpo.rol, 'rol', ROLES) : actual.rol;
    const estado = ctx.cuerpo.estado !== undefined ? v.enumerado(ctx.cuerpo.estado, 'estado', ESTADOS) : actual.estado;
    const permisos = ctx.cuerpo.permisos !== undefined ? v.permisos(ctx.cuerpo.permisos) : JSON.parse(actual.permisos);

    if (id === admin.id && rol !== 'admin') {
      throw errores.regla('No puede quitarse a sí mismo el rol de administrador.');
    }
    if (id === admin.id && estado !== 'aprobado') {
      throw errores.regla('No puede desactivar su propia cuenta.');
    }
    const eraAdminActivo = actual.rol === 'admin' && actual.estado === 'aprobado';
    const seraAdminActivo = rol === 'admin' && estado === 'aprobado';
    if (eraAdminActivo && !seraAdminActivo && contarAdmins() <= 1) {
      throw errores.regla('Debe existir al menos un administrador activo en el sistema.');
    }

    run(
      `UPDATE usuarios SET nombre = ?, rol = ?, estado = ?, permisos = ?, actualizado_en = ? WHERE id = ?`,
      nombre,
      rol,
      estado,
      JSON.stringify(permisos),
      new Date().toISOString(),
      id,
    );
    if (estado !== 'aprobado') {
      run('UPDATE sesiones SET revocada = 1 WHERE usuario_id = ?', id);
    }
    const actualizado = get('SELECT * FROM usuarios WHERE id = ?', id);
    registrarAuditoria(ctx, {
      accion: 'usuario_actualizado',
      entidad: 'usuarios',
      entidadId: id,
      detalle: { antes: { rol: actual.rol, estado: actual.estado }, despues: { rol, estado } },
    });
    ctx.json({ usuario: serializar(actualizado) });
  });

  app.post('/api/usuarios/:id/aprobar', (ctx) => {
    const admin = soloAdmin(ctx);
    const id = v.id(ctx.params.id);
    const aprobar = v.booleano(ctx.cuerpo.aprobar, 'aprobar', { porDefecto: true });
    const usuario = get('SELECT * FROM usuarios WHERE id = ?', id);
    if (!usuario) throw errores.noExiste('El usuario no existe.');
    if (id === admin.id && !aprobar) throw errores.regla('No puede rechazar su propia cuenta.');
    run(
      'UPDATE usuarios SET estado = ?, actualizado_en = ? WHERE id = ?',
      aprobar ? 'aprobado' : 'rechazado',
      new Date().toISOString(),
      id,
    );
    if (!aprobar) run('UPDATE sesiones SET revocada = 1 WHERE usuario_id = ?', id);
    registrarAuditoria(ctx, {
      accion: aprobar ? 'usuario_aprobado' : 'usuario_rechazado',
      entidad: 'usuarios',
      entidadId: id,
    });
    ctx.json({ usuario: serializar(get('SELECT * FROM usuarios WHERE id = ?', id)) });
  });

  app.post('/api/usuarios/:id/reset-password', (ctx) => {
    const admin = soloAdmin(ctx);
    const id = v.id(ctx.params.id);
    const usuario = get('SELECT * FROM usuarios WHERE id = ?', id);
    if (!usuario) throw errores.noExiste('El usuario no existe.');
    const temporal = ctx.cuerpo.password || passwordTemporal();
    const erroresClave = validarPoliticaPassword(temporal);
    if (erroresClave.length) throw errores.validacion(erroresClave[0], { password: erroresClave[0] });
    run(
      `UPDATE usuarios SET password_hash = ?, debe_cambiar_clave = 1, intentos_fallidos = 0,
         bloqueado_hasta = NULL, actualizado_en = ? WHERE id = ?`,
      hashPassword(temporal),
      new Date().toISOString(),
      id,
    );
    run('UPDATE sesiones SET revocada = 1 WHERE usuario_id = ?', id);
    registrarAuditoria(ctx, { accion: 'password_reseteado', entidad: 'usuarios', entidadId: id });
    ctx.json({ ok: true, passwordTemporal: temporal });
  });

  app.delete('/api/usuarios/:id', (ctx) => {
    const admin = soloAdmin(ctx);
    const id = v.id(ctx.params.id);
    if (id === admin.id) throw errores.regla('No puede eliminar su propia cuenta.');
    const usuario = get('SELECT * FROM usuarios WHERE id = ?', id);
    if (!usuario) throw errores.noExiste('El usuario no existe.');
    if (usuario.rol === 'admin' && usuario.estado === 'aprobado' && contarAdmins() <= 1) {
      throw errores.regla('Debe existir al menos un administrador activo.');
    }
    run('DELETE FROM usuarios WHERE id = ?', id);
    registrarAuditoria(ctx, {
      accion: 'usuario_eliminado',
      entidad: 'usuarios',
      entidadId: id,
      detalle: { email: usuario.email },
    });
    ctx.sinContenido(204);
  });

  // Registro público: crea solicitudes pendientes de aprobación.
  app.post(
    '/api/registro',
    (ctx) => {
      const email = v.email(ctx.cuerpo.email);
      const nombre = v.texto(ctx.cuerpo.nombre, 'nombre', { min: 3, max: 120 });
      const clave = typeof ctx.cuerpo.password === 'string' ? ctx.cuerpo.password : '';
      const rol = v.enumerado(ctx.cuerpo.rol ?? 'determinado', 'rol', ['determinado', 'sobrecarga']);
      const erroresClave = validarPoliticaPassword(clave);
      if (erroresClave.length) throw errores.validacion(erroresClave[0], { password: erroresClave[0] });
      if (get('SELECT id FROM usuarios WHERE email = ?', email)) {
        throw errores.conflicto('Ya existe una cuenta con ese correo electrónico.');
      }
      const resultado = run(
        `INSERT INTO usuarios (email, nombre, password_hash, rol, estado, permisos, debe_cambiar_clave)
         VALUES (?, ?, ?, ?, 'pendiente', ?, 0)`,
        email,
        nombre,
        hashPassword(clave),
        rol,
        JSON.stringify({ crear: true, leer: true, actualizar: true, eliminar: true }),
      );
      registrarAuditoria(ctx, {
        accion: 'registro',
        entidad: 'usuarios',
        entidadId: Number(resultado.lastInsertRowid),
        detalle: { email, rol },
      });
      ctx.json(
        {
          ok: true,
          mensaje: 'Registro recibido. Un administrador debe aprobar su cuenta para permitir el acceso.',
        },
        201,
      );
    },
    { publica: true },
  );
}
