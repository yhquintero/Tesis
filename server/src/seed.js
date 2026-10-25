import { existsSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  abrirDb,
  all,
  cerrarDb,
  get,
  run,
  transaccion,
} from './db.js';
import { config } from './config.js';
import { hashPassword } from './auth.js';
import { CATEGORIAS_DOCENTES } from './servicios/tarifas.js';
import { VALORES_POR_DEFECTO } from './servicios/configuracion.js';
import { moneda, sumarDias } from './servicios/util.js';

const DEMO_PASSWORD = 'Demo1234!';

const TARIFAS = {
  Titular: { determinado: 45, sobrecarga: 67.5 },
  Auxiliar: { determinado: 40, sobrecarga: 60 },
  Asistente: { determinado: 36, sobrecarga: 54 },
  Instructor: { determinado: 32, sobrecarga: 48 },
  'ATD Nivel superior': { determinado: 30, sobrecarga: 45 },
  'ATD Nivel medio': { determinado: 28, sobrecarga: 42 },
  'Recién graduados': { determinado: 24, sobrecarga: 36 },
};

const PROFESORES = [
  ['3673458908', 'Darielys Hernández Mitjans', '80010100001', '2do Año', 'Profesor', 'Asistente', 180, 30, 104],
  ['123', 'Oliver W. Milán Tellería', '80010100002', '2do Año', 'Profesor', 'Asistente', 218, 30, 104],
  ['456', 'Eliomar Rodríguez Izquierdo', '80010100003', '3er Año', 'Profesor', 'Auxiliar', 231, 28, 117],
  ['789', 'Ariosky Areces González', '80010100004', '1er Año', 'Profesor', 'Instructor', 0, 0, 0],
  ['1004', 'Danilo Gutiérrez Coro', '80010100005', '4to Año', 'Profesor', 'Auxiliar', 204, 35, 90],
  ['1005', 'Rolando Moreira Río', '80010100006', '2do Año', 'Profesor', 'Asistente', 100, 16, 0],
  ['1006', 'Jorge Luis Romero Pérez', '80010100007', '3er Año', 'Profesor', 'Asistente', 228, 16, 114],
  ['1007', 'Manuel Pereira Rosa', '80010100008', '1er Año', 'Profesor', 'Auxiliar', 180, 36, 66],
  ['1008', 'Marielis Álvarez González', '80010100009', '4to Año', 'Profesor', 'Asistente', 270, 34, 156],
  ['1009', 'Alina Alfonso Morejón', '80010100010', '2do Año', 'Profesor', 'Titular', 202, 34, 88],
  ['1010', 'Yamika Concepción Pando', '80010100011', '3er Año', 'Profesor', 'Auxiliar', 230, 42, 116],
  ['1011', 'Raudel Camacho Rodríguez', '80010100012', '1er Año', 'Profesor', 'Instructor', 243, 16, 129],
  ['1012', 'José Carlos Valdés Fernández', '80010100013', '4to Año', 'Profesor', 'Instructor', 337, 44, 190],
  ['1013', 'Dayanis del C. Domínguez Guerra', '80010100014', '2do Año', 'Profesor', 'Instructor', 52, 8, 0],
  ['1014', 'Marcos Miguel Llamazares Blanco', '80010100015', '3er Año', 'Profesor', 'Instructor', 201, 28, 87],
  ['1015', 'Walfrido Novas Orama', '80010100016', '1er Año', 'Profesor', 'Auxiliar', 125, 20, 11],
  ['1016', 'Raymundo González Fernández', '80010100017', '4to Año', 'Profesor', 'Auxiliar', 159, 16, 45],
  ['1017', 'Yohan Michel Rivera Lorenzo', '80010100018', '2do Año', 'Profesor', 'Instructor', 312, 40, 190],
  ['1018', 'Frank Alejandro González Machín', '80010100019', '3er Año', 'Profesor', 'Recién graduados', 243, 40, 129],
  ['1019', 'Ricardo Inouye Rodríguez', '80010100020', '1er Año', 'Cuadros', 'Auxiliar', 150, 24, 93],
];

const USUARIOS = [
  ['amanda.herrera@upr.edu.cu', 'Amanda Beatriz Herrera Rodríguez', 'sobrecarga', 'aprobado', { crear: true, leer: true, actualizar: true, eliminar: true }],
  ['yosvany.hernandez@upr.edu.cu', 'Yosvany Hernández Quintero', 'determinado', 'aprobado', { crear: true, leer: true, actualizar: true, eliminar: true }],
  ['ricardo.inouye@upr.edu.cu', 'Ricardo Inouye Rodríguez', 'determinado', 'aprobado', { crear: true, leer: true, actualizar: true, eliminar: true }],
  ['walfrido.novas@upr.edu.cu', 'Walfrido Novas Orama', 'determinado', 'pendiente', { crear: true, leer: true, actualizar: true, eliminar: true }],
  ['eliomar.rodriguez@upr.edu.cu', 'Eliomar Rodríguez Izquierdo', 'sobrecarga', 'aprobado', { crear: true, leer: true, actualizar: true, eliminar: true }],
  ['marcos.llamazares@upr.edu.cu', 'Marcos Miguel Llamazares Blanco', 'sobrecarga', 'aprobado', { crear: true, leer: true, actualizar: true, eliminar: true }],
  ['dayanis.dominguez@upr.edu.cu', 'Dayanis del C. Domínguez Guerra', 'determinado', 'aprobado', { crear: true, leer: true, actualizar: true, eliminar: true }],
  ['frank.gonzalez@upr.edu.cu', 'Frank Alejandro González Machín', 'sobrecarga', 'aprobado', { crear: true, leer: true, actualizar: true, eliminar: false }],
  ['raudel.camacho@upr.edu.cu', 'Raudel Camacho Rodríguez', 'determinado', 'aprobado', { crear: true, leer: true, actualizar: false, eliminar: false }],
  ['prueba1@upr.edu.cu', 'Usuario de Prueba 1', 'determinado', 'aprobado', { crear: true, leer: true, actualizar: true, eliminar: true }],
  ['prueba2@upr.edu.cu', 'Usuario de Prueba 2', 'sobrecarga', 'pendiente', { crear: false, leer: true, actualizar: false, eliminar: false }],
];

function prng(semilla) {
  let a = semilla >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distribuye un total de horas en los cortes con una forma realista. */
function distribuirHoras(total, cortes, semilla) {
  const azar = prng(semilla);
  const pesos = Array.from({ length: cortes }, () => 0.6 + azar() * 0.9);
  const suma = pesos.reduce((s, p) => s + p, 0);
  const horas = pesos.map((peso) => Math.round((total * peso) / suma));
  const acumulado = horas.reduce((s, h) => s + h, 0);
  const diferencia = total - acumulado;
  if (diferencia !== 0) {
    const indice = Math.floor(azar() * cortes);
    horas[indice] = Math.max(0, horas[indice] + diferencia);
  }
  return horas;
}

function sembrar() {
  const ahora = new Date().toISOString();
  const anio = new Date().getFullYear();

  for (const [clave, valor] of Object.entries(VALORES_POR_DEFECTO)) {
    run('INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)', clave, valor);
  }

  for (const categoria of CATEGORIAS_DOCENTES) {
    for (const tipo of ['determinado', 'sobrecarga']) {
      run(
        'INSERT OR IGNORE INTO tarifas (categoria_docente, tipo, importe, vigente_desde) VALUES (?, ?, ?, ?)',
        categoria,
        tipo,
        TARIFAS[categoria][tipo],
        `${anio - 1}-01-01`,
      );
    }
  }

  const adminId = Number(
    run(
      `INSERT INTO usuarios (email, nombre, password_hash, rol, estado, permisos, debe_cambiar_clave)
       VALUES (?, ?, ?, 'admin', 'aprobado', ?, 0)`,
      config.adminEmail,
      'Administrador del Sistema',
      hashPassword(config.adminPassword),
      JSON.stringify({ crear: true, leer: true, actualizar: true, eliminar: true }),
    ).lastInsertRowid,
  );

  for (const [email, nombre, rol, estado, permisos] of USUARIOS) {
    run(
      `INSERT INTO usuarios (email, nombre, password_hash, rol, estado, permisos)
       VALUES (?, ?, ?, ?, ?, ?)`,
      email,
      nombre,
      hashPassword(DEMO_PASSWORD),
      rol,
      estado,
      JSON.stringify(permisos),
    );
  }

  const periodoId = Number(
    run(
      'INSERT INTO periodos (nombre, inicio, fin, cortes, estado) VALUES (?, ?, ?, 14, ?)',
      `${anio}-2`,
      `${anio}-09-07`,
      `${anio + 1}-02-28`,
      'abierto',
    ).lastInsertRowid,
  );

  const idsProfesores = [];
  PROFESORES.forEach((p, i) => {
    const [noTrabajador, nombre, ci, anioEstudio, categoriaPoc, categoriaDocente, thp, carga, hsp] = p;
    const id = Number(
      run(
        `INSERT INTO profesores (no_trabajador, nombre, ci, anio, area, area_ciencia,
           categoria_poc, categoria_docente, carga_horaria, correo, telefono, activo)
         VALUES (?, ?, ?, ?, 'Facultad de Ciencias Técnicas', 'Ingeniería en Informática',
                 ?, ?, ?, ?, ?, 1)`,
        noTrabajador,
        nombre,
        ci,
        anioEstudio,
        categoriaPoc,
        categoriaDocente,
        8,
        `profesor${i + 1}@upr.edu.cu`,
        `+53 48 ${String(7000000 + i * 137).slice(0, 7)}`,
      ).lastInsertRowid,
    );
    idsProfesores.push(id);
    const horas = distribuirHoras(thp, 14, 1000 + i);
    horas.forEach((h, corte) => {
      run(
        'INSERT INTO cargas (periodo_id, profesor_id, corte, horas) VALUES (?, ?, ?, ?)',
        periodoId,
        id,
        corte + 1,
        h,
      );
    });
    void hsp;
  });

  const contratos = [
    { prof: 0, tipo: 'determinado', objeto: 'Docencia de Programación I en el segundo año de Ingeniería en Informática', estado: 'activo', inicio: `${anio}-09-07`, fin: `${anio + 1}-01-31`, horas: 64 },
    { prof: 1, tipo: 'determinado', objeto: 'Docencia de Bases de Datos en Ingeniería en Informática', estado: 'activo', inicio: `${anio}-09-07`, fin: `${anio + 1}-01-31`, horas: 80 },
    { prof: 2, tipo: 'sobrecarga', objeto: 'Horas de sobrecarga para la asignatura Estructuras de Datos', estado: 'activo', inicio: `${anio}-09-15`, fin: `${anio + 1}-02-15`, horas: 96 },
    { prof: 3, tipo: 'determinado', objeto: 'Preparación de asignatura optativa de Inteligencia Artificial', estado: 'pendiente', inicio: `${anio}-10-01`, fin: `${anio + 1}-03-31`, horas: 48 },
    { prof: 5, tipo: 'sobrecarga', objeto: 'Sobrecarga docente en Laboratorio de Redes', estado: 'aprobado', inicio: `${anio}-09-20`, fin: `${anio + 1}-02-20`, horas: 72 },
    { prof: 7, tipo: 'determinado', objeto: 'Docencia de Matemática Discreta', estado: 'completado', inicio: `${anio}-01-15`, fin: `${anio}-06-30`, horas: 90 },
    { prof: 8, tipo: 'sobrecarga', objeto: 'Sobrecarga en la asignatura Compiladores', estado: 'activo', inicio: `${anio}-09-07`, fin: `${anio + 1}-01-31`, horas: 56 },
    { prof: 9, tipo: 'determinado', objeto: 'Docencia de Ingeniería de Software', estado: 'rechazado', inicio: `${anio}-10-01`, fin: `${anio + 1}-02-28`, horas: 40 },
    { prof: 11, tipo: 'sobrecarga', objeto: 'Sobrecarga docente en Física Computacional', estado: 'borrador', inicio: `${anio}-11-01`, fin: `${anio + 1}-03-31`, horas: 32 },
    { prof: 12, tipo: 'determinado', objeto: 'Docencia de Arquitectura de Computadoras', estado: 'cancelado', inicio: `${anio}-09-07`, fin: `${anio + 1}-01-31`, horas: 60 },
  ];

  let secuenciaDet = 0;
  let secuenciaSob = 0;
  for (const c of contratos) {
    const profesor = get('SELECT * FROM profesores WHERE id = ?', idsProfesores[c.prof]);
    const tarifa = get(
      'SELECT * FROM tarifas WHERE categoria_docente = ? AND tipo = ? ORDER BY vigente_desde DESC LIMIT 1',
      profesor.categoria_docente,
      c.tipo,
    );
    const prefijo = c.tipo === 'determinado' ? 'CD' : 'CS';
    if (c.tipo === 'determinado') secuenciaDet += 1;
    else secuenciaSob += 1;
    const codigo = `${prefijo}-${anio}-${String(c.tipo === 'determinado' ? secuenciaDet : secuenciaSob).padStart(3, '0')}`;
    const clausulas = [
      `El profesor ${profesor.nombre} prestará servicios docentes entre el ${c.inicio} y el ${c.fin}, con un total de ${c.horas} horas.`,
      'El contrato se rige por la Resolución 210/2023 del MES y la legislación laboral vigente.',
      'El pago se procesará dentro de los 30 días posteriores a la finalización del contrato.',
    ];
    const aprobado = ['aprobado', 'activo', 'completado'].includes(c.estado);
    const contratoId = Number(
      run(
        `INSERT INTO contratos (codigo, profesor_id, tipo, objeto, periodo, fecha_inicio, fecha_fin,
           horas, tarifa_hora, importe, clausulas, estado, aprobado_por, aprobado_en, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        codigo,
        profesor.id,
        c.tipo,
        c.objeto,
        `${anio}-2`,
        c.inicio,
        c.fin,
        c.horas,
        tarifa.importe,
        moneda(c.horas * tarifa.importe),
        JSON.stringify(clausulas),
        c.estado,
        aprobado ? adminId : null,
        aprobado ? ahora : null,
        adminId,
      ).lastInsertRowid,
    );
    if (['activo', 'completado'].includes(c.estado)) {
      const pagado = c.estado === 'completado';
      const estadoPago = pagado ? 'pagado' : 'pendiente';
      run(
        `INSERT INTO pagos (contrato_id, periodo, horas, tarifa, importe, estado, fecha_limite,
           fecha_pago, aprobado_por, aprobado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        contratoId,
        `${anio}-2`,
        c.horas,
        tarifa.importe,
        moneda(c.horas * tarifa.importe),
        estadoPago,
        sumarDias(c.fin, 30),
        pagado ? sumarDias(c.fin, 12) : null,
        pagado ? adminId : null,
        pagado ? ahora : null,
      );
    }
  }

  run(
    'INSERT INTO auditoria (usuario_id, email, accion, entidad, detalle, creado_en) VALUES (?, ?, ?, ?, ?, ?)',
    adminId,
    config.adminEmail,
    'instalacion',
    'sistema',
    'Base de datos inicializada con datos de demostración.',
    ahora,
  );
}

export function sembrarSiVacio({ forzar = false } = {}) {
  if (forzar) {
    cerrarDb();
    for (const sufijo of ['', '-wal', '-shm']) {
      const ruta = `${config.dbFile}${sufijo}`;
      if (existsSync(ruta)) rmSync(ruta, { force: true });
    }
  }
  abrirDb();
  const usuarios = get('SELECT COUNT(*) AS n FROM usuarios').n;
  if (usuarios > 0) return { sembrado: false, usuarios };
  transaccion(() => sembrar());
  const total = get('SELECT COUNT(*) AS n FROM usuarios').n;
  return { sembrado: true, usuarios: total };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const forzar = process.argv.includes('--force');
  const resultado = sembrarSiVacio({ forzar });
  console.log(
    resultado.sembrado
      ? `Base de datos creada con ${resultado.usuarios} usuarios.`
      : `La base de datos ya contiene ${resultado.usuarios} usuarios. Use --force para reiniciarla.`,
  );
  const profesores = all('SELECT COUNT(*) AS n FROM profesores')[0].n;
  const contratos = all('SELECT COUNT(*) AS n FROM contratos')[0].n;
  console.log(`Profesores: ${profesores} · Contratos: ${contratos}`);
  cerrarDb();
}
