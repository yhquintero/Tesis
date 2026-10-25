import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '..', '..');

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  puerto: envInt('PRENOMINA_PORT', 3000),
  host: process.env.PRENOMINA_HOST || '0.0.0.0',
  dataDir: process.env.PRENOMINA_DATA_DIR
    ? resolve(process.env.PRENOMINA_DATA_DIR)
    : join(ROOT, 'data'),
  webDir: join(ROOT, 'web'),
  dbFile: process.env.PRENOMINA_DB || join(ROOT, 'data', 'prenomina.db'),
  schemaFile: join(ROOT, 'db', 'schema.sql'),
  version: '1.0.0',
  accessTtlMin: envInt('PRENOMINA_ACCESS_TTL', 30),
  refreshTtlDays: envInt('PRENOMINA_REFRESH_TTL', 7),
  maxIntentos: 5,
  bloqueoMin: 15,
  maxBodyBytes: 2 * 1024 * 1024,
  retencionRespaldosDias: 30,
  adminEmail: process.env.PRENOMINA_ADMIN_EMAIL || 'admin@upr.edu.cu',
  adminPassword: process.env.PRENOMINA_ADMIN_PASSWORD || 'Admin1234!',
  tls: {
    key: process.env.PRENOMINA_TLS_KEY || '',
    cert: process.env.PRENOMINA_TLS_CERT || '',
  },
};

export function ensureDirs() {
  for (const dir of [config.dataDir, join(config.dataDir, 'backups')]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

/** Secreto HMAC persistente: se genera una vez y se guarda fuera del control de versiones. */
export function secreto() {
  ensureDirs();
  const file = join(config.dataDir, '.secreto');
  if (!existsSync(file)) {
    writeFileSync(file, randomBytes(48).toString('hex'), { encoding: 'utf8', mode: 0o600 });
  }
  return readFileSync(file, 'utf8').trim();
}
