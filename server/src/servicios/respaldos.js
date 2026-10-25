import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { config, ensureDirs } from '../config.js';
import { abrirDb, all, cerrarDb, get, run } from '../db.js';
import { errores } from '../lib/http.js';

function dirRespaldos() {
  ensureDirs();
  const dir = join(config.dataDir, 'backups');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function serializar(fila) {
  return {
    id: fila.id,
    archivo: fila.archivo,
    bytes: fila.bytes,
    creadoEn: fila.creado_en,
  };
}

export function crearRespaldo(motivo = 'manual') {
  const dir = dirRespaldos();
  const sello = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 19);
  const archivo = `prenomina-${sello}-${Math.random().toString(36).slice(2, 6)}.db`;
  const destino = join(dir, archivo);
  const db = abrirDb();
  db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  const bytes = statSync(destino).size;
  const resultado = run(
    'INSERT INTO respaldos (archivo, bytes) VALUES (?, ?)',
    archivo,
    bytes,
  );
  const fila = get('SELECT * FROM respaldos WHERE id = ?', Number(resultado.lastInsertRowid));
  return { ...serializar(fila), motivo };
}

export function listarRespaldos() {
  return all('SELECT * FROM respaldos ORDER BY creado_en DESC, id DESC LIMIT 100').map(serializar);
}

export function rutaRespaldo(id) {
  const fila = get('SELECT * FROM respaldos WHERE id = ?', id);
  if (!fila) throw errores.noExiste('El respaldo no existe.');
  const ruta = join(dirRespaldos(), fila.archivo);
  if (!existsSync(ruta)) throw errores.noExiste('El archivo de respaldo ya no está disponible.');
  return { ruta, fila };
}

export function verificarIntegridad(ruta) {
  const temporal = new DatabaseSync(ruta, { readOnly: true });
  try {
    const resultado = temporal.prepare('PRAGMA integrity_check').get();
    const valor = resultado?.integrity_check ?? Object.values(resultado || {})[0];
    if (valor !== 'ok') throw errores.regla(`El respaldo está dañado: ${valor}`);
    const tablas = temporal
      .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('usuarios','contratos','pagos','profesores')")
      .get();
    if (!tablas || tablas.n < 4) {
      throw errores.regla('El archivo no corresponde a una base de datos de Prenómina UPR.');
    }
  } finally {
    temporal.close();
  }
}

export function restaurarRespaldo(id) {
  const { ruta } = rutaRespaldo(id);
  verificarIntegridad(ruta);
  cerrarDb();
  for (const sufijo of ['-wal', '-shm']) {
    const extra = `${config.dbFile}${sufijo}`;
    if (existsSync(extra)) rmSync(extra, { force: true });
  }
  copyFileSync(ruta, config.dbFile);
  abrirDb();
  const comprobacion = get('SELECT COUNT(*) AS n FROM usuarios');
  if (!comprobacion) throw errores.regla('La restauración no pudo verificarse.');
  return { ok: true, usuarios: comprobacion.n };
}

export function limpiarRespaldosAntiguos(dias = config.retencionRespaldosDias) {
  const limite = new Date(Date.now() - dias * 86400000).toISOString();
  const antiguos = all('SELECT * FROM respaldos WHERE creado_en < ?', limite);
  let eliminados = 0;
  for (const fila of antiguos) {
    const ruta = join(dirRespaldos(), fila.archivo);
    if (existsSync(ruta)) rmSync(ruta, { force: true });
    run('DELETE FROM respaldos WHERE id = ?', fila.id);
    eliminados += 1;
  }
  return eliminados;
}

export function respaldoAutomaticoPendiente() {
  const hoy = new Date().toISOString().slice(0, 10);
  const ultimo = get('SELECT creado_en FROM respaldos ORDER BY creado_en DESC LIMIT 1');
  return !ultimo || !String(ultimo.creado_en).startsWith(hoy);
}
