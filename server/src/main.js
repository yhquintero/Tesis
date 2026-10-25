import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { config } from './config.js';
import { crearApp } from './lib/http.js';
import { registrarAuditoria } from './lib/auditoria.js';
import { cerrarDb } from './db.js';
import { sembrarSiVacio } from './seed.js';
import { registrarRutasAuth } from './rutas/auth.js';
import { registrarRutasUsuarios } from './rutas/usuarios.js';
import { registrarRutasProfesores } from './rutas/profesores.js';
import { registrarRutasPeriodos } from './rutas/periodos.js';
import { registrarRutasContratos } from './rutas/contratos.js';
import { registrarRutasPagos } from './rutas/pagos.js';
import { registrarRutasSistema } from './rutas/sistema.js';
import {
  crearRespaldo,
  limpiarRespaldosAntiguos,
  respaldoAutomaticoPendiente,
} from './servicios/respaldos.js';
import { version } from './servicios/version.js';

function arrancar() {
  const siembra = sembrarSiVacio();
  const { app, servidor } = crearApp({ registrarAuditoria });

  registrarRutasAuth(app);
  registrarRutasUsuarios(app);
  registrarRutasProfesores(app);
  registrarRutasPeriodos(app);
  registrarRutasContratos(app);
  registrarRutasPagos(app);
  registrarRutasSistema(app);

  const servidorHttp = config.tls.key
    ? https.createServer(
        {
          key: readFileSync(config.tls.key),
          cert: readFileSync(config.tls.cert),
          minVersion: 'TLSv1.2',
        },
        servidor,
      )
    : http.createServer(servidor);

  servidorHttp.listen(config.puerto, config.host, () => {
    const protocolo = config.tls.key ? 'https' : 'http';
    console.log('');
    console.log('  Prenómina UPR · Sistema de Contratos y Sobrecarga Docente');
    console.log(`  Versión ${version} · ${new Date().toLocaleString('es-CU')}`);
    console.log(`  Servidor: ${protocolo}://localhost:${config.puerto}`);
    console.log(`  Base de datos: ${config.dbFile}`);
    if (siembra.sembrado) {
      console.log('');
      console.log('  Primer arranque: base de datos creada con datos de demostración.');
      console.log(`  Administrador: ${config.adminEmail} / ${config.adminPassword}`);
      console.log('  Usuarios de demostración: clave Demo1234!');
      console.log('  Cambie la contraseña del administrador en el primer acceso.');
      console.log('');
    }
  });

  servidorHttp.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`El puerto ${config.puerto} está ocupado. Cierre el proceso o defina PRENOMINA_PORT.`);
    } else {
      console.error('Error del servidor:', error);
    }
    process.exitCode = 1;
  });

  const respaldar = () => {
    try {
      if (respaldoAutomaticoPendiente()) {
        const respaldo = crearRespaldo('automatico');
        const eliminados = limpiarRespaldosAntiguos();
        console.log(`[respaldo] ${respaldo.archivo} (${(respaldo.bytes / 1024).toFixed(1)} KB)` +
          (eliminados ? ` · ${eliminados} respaldo(s) antiguo(s) eliminado(s)` : ''));
      }
    } catch (error) {
      console.error('[respaldo] Error:', error.message);
    }
  };
  setTimeout(respaldar, 8000);
  const temporizador = setInterval(respaldar, 30 * 60 * 1000);
  temporizador.unref();

  const cerrar = (senal) => {
    console.log(`\nCerrando (${senal})...`);
    servidorHttp.close(() => {
      cerrarDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => cerrar('SIGINT'));
  process.on('SIGTERM', () => cerrar('SIGTERM'));

  return servidorHttp;
}

arrancar();
