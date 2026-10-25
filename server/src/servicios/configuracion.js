import { all, get, run } from '../db.js';

export const VALORES_POR_DEFECTO = {
  nombre_institucion: 'Universidad de Pinar del Río «Hermanos Saíz Montes de Oca»',
  departamento: 'Departamento de Informática',
  facultad: 'Facultad de Ciencias Técnicas',
  moneda: 'CUP',
  simbolo_moneda: '$',
  dias_pago: '30',
  meses_max_contrato: '12',
  max_intentos: '5',
  minutos_bloqueo: '15',
  respaldo_automatico: '1',
  hora_respaldo: '02:00',
  correo_soporte: 'soporte@upr.edu.cu',
  telefono_soporte: '+53 48 75 0000',
  direccion: 'Calle Martí # 300, Pinar del Río, Cuba',
  version_esquema: '1',
};

export function configuracion() {
  const filas = all('SELECT clave, valor FROM configuracion');
  const valores = { ...VALORES_POR_DEFECTO };
  for (const fila of filas) valores[fila.clave] = fila.valor;
  return valores;
}

export function valor(clave) {
  const fila = get('SELECT valor FROM configuracion WHERE clave = ?', clave);
  return fila ? fila.valor : VALORES_POR_DEFECTO[clave];
}

export function guardarConfiguracion(cambios) {
  for (const [clave, val] of Object.entries(cambios)) {
    if (!(clave in VALORES_POR_DEFECTO)) continue;
    run(
      `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
      clave,
      String(val),
    );
  }
  return configuracion();
}
