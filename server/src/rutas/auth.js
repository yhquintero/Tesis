import { all, get, run } from '../db.js';
import {
  cookie,
  emitirToken,
  hashPassword,
  hashToken,
  nuevoRefreshToken,
  passwordTemporal,
  tokenCsrf,
  validarPoliticaPassword,
  verificarPassword,
} from '../auth.js';
import { config } from '../config.js';
import { HttpError, errores } from '../lib/http.js';
import * as v from '../lib/validar.js';
import { autenticar, sanitizarUsuario, soloAdmin } from '../lib/sesion.js';
import { registrarAuditoria } from '../lib/auditoria.js';

const intentosIp = new Map();
const VENTANA_MS = 15 * 60 * 1000;

function limitarPorIp(ip) {
  const ahora = Date.now();
  const registro = intentosIp.get(ip) || { veces: 0, desde: ahora };
  if (ahora - registro.desde > VENTANA_MS) {
    registro.veces = 0;
    registro.desde = ahora;
  }
  registro.veces += 1;
  intentosIp.set(ip, registro);
  if (registro.veces > 40) {
    throw errores.limite('Demasiadas solicitudes desde esta dirección. Espere 15 minutos.');
  }
}

function cookiesDeSesion({ token, refresh, csrf }) {
  const secure = Boolean(config.tls.key);
  return [
    cookie('pn_sesion', token, { httpOnly: true, secure, maxAge: config.accessTtlMin * 60 }),
    cookie('pn_refresh', refresh, {
      httpOnly: true,
      secure,
      maxAge: config.refreshTtlDays * 86400,
      path: '/api/auth',
    }),
    cookie('pn_csrf', csrf, {
      httpOnly: false,
      secure,
      maxAge: config.refreshTtlDays * 86400,
    }),
  ];
}

function crearSesion(usuario, cliente) {
  const refresh = nuevoRefreshToken();
  const expira = new Date(Date.now() + config.refreshTtlDays * 86400 * 1000).toISOString();
  run(
    'INSERT INTO sesiones (usuario_id, token_hash, expira_en, cliente) VALUES (?, ?, ?, ?)',
    usuario.id,
    hashToken(refresh),
    expira,
    cliente || 'web',
  );
  const { token, expiraEn } = emitirToken(usuario);
  const csrf = tokenCsrf();
  return {
    cuerpo: {
      accessToken: token,
      expiraEn,
      refreshToken: refresh,
      csrfToken: csrf,
      usuario: sanitizarUsuario(usuario),
    },
    cabeceras: { 'Set-Cookie': cookiesDeSesion({ token, refresh, csrf }) },
  };
}

export function registrarRutasAuth(app) {
  app.post(
    '/api/auth/login',
    (ctx) => {
      limitarPorIp(ctx.ip);
      const email = v.email(ctx.cuerpo.email);
      if (typeof ctx.cuerpo.password !== 'string' || !ctx.cuerpo.password) {
        throw errores.validacion('La contraseña es obligatoria.', { password: 'Campo obligatorio.' });
      }
      const password = ctx.cuerpo.password;
      const cliente = ctx.cuerpo.cliente === 'android' ? 'android' : 'web';

      const usuario = get('SELECT * FROM usuarios WHERE email = ?', email);
      if (!usuario) throw errores.noAutenticado('Correo o contraseña incorrectos.');

      if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
        const minutos = Math.max(
          1,
          Math.ceil((new Date(usuario.bloqueado_hasta).getTime() - Date.now()) / 60000),
        );
        throw new HttpError(
          423,
          'CUENTA_BLOQUEADA',
          `Cuenta bloqueada por intentos fallidos. Intente de nuevo en ${minutos} minuto(s).`,
        );
      }

      if (!verificarPassword(password, usuario.password_hash)) {
        const fallos = usuario.intentos_fallidos + 1;
        const bloquear = fallos >= config.maxIntentos;
        run(
          'UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?',
          fallos,
          bloquear ? new Date(Date.now() + config.bloqueoMin * 60000).toISOString() : null,
          usuario.id,
        );
        registrarAuditoria(ctx, {
          accion: 'login_fallido',
          entidad: 'usuarios',
          entidadId: usuario.id,
          detalle: { email, intento: fallos },
        });
        if (bloquear) {
          throw new HttpError(
            423,
            'CUENTA_BLOQUEADA',
            `Se alcanzaron ${config.maxIntentos} intentos fallidos. La cuenta quedó bloqueada ${config.bloqueoMin} minutos.`,
          );
        }
        throw errores.noAutenticado(
          `Correo o contraseña incorrectos. Le quedan ${config.maxIntentos - fallos} intento(s).`,
        );
      }

      if (usuario.estado !== 'aprobado') {
        throw errores.sinPermiso(
          usuario.estado === 'pendiente'
            ? 'Su cuenta está pendiente de aprobación por un administrador.'
            : 'Su cuenta fue rechazada o desactivada.',
        );
      }

      run(
        'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = ? WHERE id = ?',
        new Date().toISOString(),
        usuario.id,
      );
      const { cuerpo, cabeceras } = crearSesion(usuario, cliente);
      ctx.usuario = usuario;
      registrarAuditoria(ctx, { accion: 'login', entidad: 'usuarios', entidadId: usuario.id });
      ctx.json(cuerpo, 200, cabeceras);
    },
    { publica: true },
  );

  app.post(
    '/api/auth/refresh',
    (ctx) => {
      const recibido = ctx.cuerpo?.refreshToken || ctx.cookies.pn_refresh;
      if (!recibido) throw errores.noAutenticado('No hay sesión que renovar.');
      const sesion = get('SELECT * FROM sesiones WHERE token_hash = ? AND revocada = 0', hashToken(recibido));
      if (!sesion || new Date(sesion.expira_en) <= new Date()) {
        throw errores.noAutenticado('La sesión expiró. Inicie sesión nuevamente.');
      }
      const usuario = get('SELECT * FROM usuarios WHERE id = ?', sesion.usuario_id);
      if (!usuario || usuario.estado !== 'aprobado') {
        throw errores.sinPermiso('La cuenta no está activa.');
      }
      run('UPDATE sesiones SET revocada = 1 WHERE id = ?', sesion.id);
      const { cuerpo, cabeceras } = crearSesion(usuario, sesion.cliente);
      ctx.json(cuerpo, 200, cabeceras);
    },
    { publica: true },
  );

  app.post('/api/auth/logout', (ctx) => {
    const recibido = ctx.cuerpo?.refreshToken || ctx.cookies.pn_refresh;
    if (recibido) run('UPDATE sesiones SET revocada = 1 WHERE token_hash = ?', hashToken(recibido));
    ctx.json(
      { ok: true },
      200,
      {
        'Set-Cookie': [
          cookie('pn_sesion', '', { maxAge: 0 }),
          cookie('pn_refresh', '', { maxAge: 0, path: '/api/auth' }),
          cookie('pn_csrf', '', { maxAge: 0, httpOnly: false }),
        ],
      },
    );
  });

  app.get('/api/auth/me', (ctx) => {
    const usuario = autenticar(ctx);
    ctx.json({ usuario: sanitizarUsuario(usuario) });
  });

  app.post('/api/auth/password', (ctx) => {
    const usuario = autenticar(ctx);
    const actual = typeof ctx.cuerpo.actual === 'string' ? ctx.cuerpo.actual : '';
    const nueva = typeof ctx.cuerpo.nueva === 'string' ? ctx.cuerpo.nueva : '';
    if (!actual || !nueva) {
      throw errores.validacion('Debe indicar la contraseña actual y la nueva.');
    }
    if (!verificarPassword(actual, usuario.password_hash)) {
      throw errores.validacion('La contraseña actual no es correcta.', { actual: 'Contraseña incorrecta.' });
    }
    const erroresPolitica = validarPoliticaPassword(nueva);
    if (erroresPolitica.length) {
      throw errores.validacion(erroresPolitica[0], { nueva: erroresPolitica[0] });
    }
    if (actual === nueva) {
      throw errores.validacion('La nueva contraseña debe ser diferente a la actual.', {
        nueva: 'Elija una contraseña distinta.',
      });
    }
    run(
      'UPDATE usuarios SET password_hash = ?, debe_cambiar_clave = 0, actualizado_en = ? WHERE id = ?',
      hashPassword(nueva),
      new Date().toISOString(),
      usuario.id,
    );
    run('UPDATE sesiones SET revocada = 1 WHERE usuario_id = ?', usuario.id);
    registrarAuditoria(ctx, { accion: 'cambio_password', entidad: 'usuarios', entidadId: usuario.id });
    ctx.json({ ok: true, reautenticar: true });
  });

  app.post(
    '/api/auth/recuperar',
    (ctx) => {
      limitarPorIp(ctx.ip);
      const email = v.email(ctx.cuerpo.email);
      const usuario = get('SELECT id FROM usuarios WHERE email = ?', email);
      if (usuario) {
        const recientes = get(
          'SELECT COUNT(*) AS n FROM recuperaciones WHERE email = ? AND creado_en > ?',
          email,
          new Date(Date.now() - 86400000).toISOString(),
        ).n;
        if (recientes < 3) {
          run('INSERT INTO recuperaciones (email) VALUES (?)', email);
          registrarAuditoria(ctx, {
            accion: 'solicitud_recuperacion',
            entidad: 'usuarios',
            entidadId: usuario.id,
          });
        }
      }
      ctx.json(
        {
          ok: true,
          mensaje:
            'Solicitud registrada. El administrador del departamento restablecerá su contraseña y le entregará una clave temporal.',
        },
        202,
      );
    },
    { publica: true },
  );

  app.get('/api/recuperaciones', (ctx) => {
    soloAdmin(ctx);
    const estado = ctx.query.estado || 'pendiente';
    const items = all(
      `SELECT r.*, u.nombre AS usuario_nombre
         FROM recuperaciones r LEFT JOIN usuarios u ON u.email = r.email
        ${estado === 'todas' ? '' : 'WHERE r.estado = ?'}
        ORDER BY r.creado_en DESC LIMIT 100`,
      ...(estado === 'todas' ? [] : [estado]),
    ).map((r) => ({
      id: r.id,
      email: r.email,
      usuario: r.usuario_nombre,
      estado: r.estado,
      creadoEn: r.creado_en,
      atendidoEn: r.atendido_en,
    }));
    ctx.json({ items });
  });

  app.post('/api/recuperaciones/:id/atender', (ctx) => {
    const admin = soloAdmin(ctx);
    const id = v.id(ctx.params.id);
    const accion = v.enumerado(ctx.cuerpo.accion, 'accion', ['reset', 'rechazar']);
    const solicitud = get('SELECT * FROM recuperaciones WHERE id = ?', id);
    if (!solicitud) throw errores.noExiste('La solicitud no existe.');
    if (solicitud.estado !== 'pendiente') throw errores.conflicto('La solicitud ya fue atendida.');
    const usuario = get('SELECT * FROM usuarios WHERE email = ?', solicitud.email);
    if (!usuario) throw errores.noExiste('El usuario solicitante ya no existe.');

    if (accion === 'rechazar') {
      run(
        "UPDATE recuperaciones SET estado = 'rechazada', atendido_por = ?, atendido_en = ? WHERE id = ?",
        admin.id,
        new Date().toISOString(),
        id,
      );
      registrarAuditoria(ctx, { accion: 'recuperacion_rechazada', entidad: 'recuperaciones', entidadId: id });
      ctx.json({ ok: true });
      return;
    }

    const temporal = passwordTemporal();
    run(
      `UPDATE usuarios SET password_hash = ?, debe_cambiar_clave = 1, intentos_fallidos = 0,
         bloqueado_hasta = NULL, estado = 'aprobado', actualizado_en = ? WHERE id = ?`,
      hashPassword(temporal),
      new Date().toISOString(),
      usuario.id,
    );
    run('UPDATE sesiones SET revocada = 1 WHERE usuario_id = ?', usuario.id);
    run(
      "UPDATE recuperaciones SET estado = 'atendida', atendido_por = ?, atendido_en = ? WHERE id = ?",
      admin.id,
      new Date().toISOString(),
      id,
    );
    registrarAuditoria(ctx, { accion: 'recuperacion_atendida', entidad: 'usuarios', entidadId: usuario.id });
    ctx.json({ ok: true, passwordTemporal: temporal });
  });
}
