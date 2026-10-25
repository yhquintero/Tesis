import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { config, ensureDirs } from './config.js';

let db = null;

export function abrirDb() {
  if (db) return db;
  ensureDirs();
  db = new DatabaseSync(config.dbFile);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(readFileSync(config.schemaFile, 'utf8'));
  return db;
}

export function cerrarDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export function get(sql, ...params) {
  return abrirDb().prepare(sql).get(...params);
}

export function all(sql, ...params) {
  return abrirDb().prepare(sql).all(...params);
}

export function run(sql, ...params) {
  return abrirDb().prepare(sql).run(...params);
}

export function exec(sql) {
  return abrirDb().exec(sql);
}

/** Ejecuta fn dentro de una transacción; revierte si lanza. */
export function transaccion(fn) {
  const conn = abrirDb();
  conn.exec('BEGIN IMMEDIATE');
  try {
    const resultado = fn();
    conn.exec('COMMIT');
    return resultado;
  } catch (error) {
    try {
      conn.exec('ROLLBACK');
    } catch {
      /* la transacción ya no estaba activa */
    }
    throw error;
  }
}

export function dbExiste() {
  return existsSync(config.dbFile);
}

export function ahora() {
  return new Date().toISOString();
}

/** Convierte una fila con JSON almacenado en texto a objeto. */
export function parseJson(valor, porDefecto) {
  if (valor === null || valor === undefined || valor === '') return porDefecto;
  try {
    return JSON.parse(valor);
  } catch {
    return porDefecto;
  }
}
