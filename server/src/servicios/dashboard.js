import { all, get } from '../db.js';
import { calcular, obtenerPeriodo } from './prenomina.js';
import { moneda } from './util.js';

export function construirDashboard() {
  const totalUsuarios = get('SELECT COUNT(*) AS n FROM usuarios').n;
  const usuariosAprobados = get("SELECT COUNT(*) AS n FROM usuarios WHERE estado = 'aprobado'").n;
  const usuariosPendientes = get("SELECT COUNT(*) AS n FROM usuarios WHERE estado = 'pendiente'").n;
  const profesoresActivos = get('SELECT COUNT(*) AS n FROM profesores WHERE activo = 1').n;
  const profesoresTotal = get('SELECT COUNT(*) AS n FROM profesores').n;
  const contratosActivos = get("SELECT COUNT(*) AS n FROM contratos WHERE estado = 'activo'").n;
  const contratosPendientes = get("SELECT COUNT(*) AS n FROM contratos WHERE estado = 'pendiente'").n;
  const pagosPendientes = get(
    "SELECT COUNT(*) AS n, COALESCE(SUM(importe),0) AS importe FROM pagos WHERE estado = 'pendiente'",
  );
  const pagosVencidos = get(
    "SELECT COUNT(*) AS n, COALESCE(SUM(importe),0) AS importe FROM pagos WHERE estado IN ('pendiente','aprobado') AND fecha_limite < date('now')",
  );

  let periodo = null;
  try {
    periodo = obtenerPeriodo();
  } catch {
    periodo = null;
  }
  let prenomina = null;
  if (periodo) {
    try {
      prenomina = calcular(periodo.id);
    } catch {
      prenomina = null;
    }
  }

  const usuariosPorRol = all(
    'SELECT rol, COUNT(*) AS cantidad FROM usuarios GROUP BY rol ORDER BY cantidad DESC',
  );
  const permisos = [
    { permiso: 'Crear', cantidad: get("SELECT COUNT(*) AS n FROM usuarios WHERE json_extract(permisos,'$.crear') = 1").n },
    { permiso: 'Leer', cantidad: get("SELECT COUNT(*) AS n FROM usuarios WHERE json_extract(permisos,'$.leer') = 1").n },
    { permiso: 'Actualizar', cantidad: get("SELECT COUNT(*) AS n FROM usuarios WHERE json_extract(permisos,'$.actualizar') = 1").n },
    { permiso: 'Eliminar', cantidad: get("SELECT COUNT(*) AS n FROM usuarios WHERE json_extract(permisos,'$.eliminar') = 1").n },
  ];
  const estadosUsuarios = all(
    `SELECT CASE WHEN estado = 'aprobado' THEN 'Aprobado' ELSE 'No Aprobado' END AS estado,
            COUNT(*) AS cantidad
       FROM usuarios GROUP BY 1`,
  );
  const distribucionProfesores = all(
    'SELECT categoria_docente AS categoria, COUNT(*) AS cantidad FROM profesores WHERE activo = 1 GROUP BY 1 ORDER BY cantidad DESC',
  );
  const pagoPorSobrecarga = all(
    `SELECT pr.categoria_docente AS categoria, COALESCE(SUM(pg.importe),0) AS importe, COUNT(*) AS cantidad
       FROM pagos pg
       JOIN contratos c ON c.id = pg.contrato_id
       JOIN profesores pr ON pr.id = c.profesor_id
      WHERE c.tipo = 'sobrecarga' AND pg.estado <> 'anulado'
      GROUP BY pr.categoria_docente ORDER BY importe DESC`,
  );
  const contratosRecientes = all(
    `SELECT c.id, c.codigo, c.tipo, c.estado, c.importe, c.fecha_fin, p.nombre AS profesor
       FROM contratos c JOIN profesores p ON p.id = c.profesor_id
      ORDER BY c.creado_en DESC LIMIT 6`,
  );
  const pagosPendientesLista = all(
    `SELECT pg.id, pg.periodo, pg.importe, pg.fecha_limite, c.codigo, p.nombre AS profesor
       FROM pagos pg
       JOIN contratos c ON c.id = pg.contrato_id
       JOIN profesores p ON p.id = c.profesor_id
      WHERE pg.estado IN ('pendiente','aprobado')
      ORDER BY pg.fecha_limite ASC LIMIT 6`,
  );

  const contratosPorEstado = all(
    'SELECT estado, COUNT(*) AS cantidad, COALESCE(SUM(importe),0) AS importe FROM contratos GROUP BY estado',
  );

  return {
    periodo: periodo ? { id: periodo.id, nombre: periodo.nombre, estado: periodo.estado } : null,
    kpis: {
      usuarios: totalUsuarios,
      usuariosAprobados,
      usuariosPendientes,
      profesores: profesoresTotal,
      profesoresActivos,
      contratosActivos,
      contratosPendientes,
      pagosPendientes: pagosPendientes.n,
      importePendiente: moneda(pagosPendientes.importe),
      pagosVencidos: pagosVencidos.n,
      importeVencido: moneda(pagosVencidos.importe),
      horasPeriodo: prenomina ? prenomina.totales.thp : 0,
      importePeriodo: prenomina ? prenomina.totales.tpp : 0,
      contratosTotal: get('SELECT COUNT(*) AS n FROM contratos').n,
      importeContratos: moneda(get('SELECT COALESCE(SUM(importe),0) AS n FROM contratos').n),
    },
    usuariosPorRol,
    permisos,
    estados: estadosUsuarios,
    horasPorCategoria: prenomina
      ? prenomina.resumenCategorias.map((r) => ({
          categoria: r.categoriaDocente,
          horas: r.thp,
          importe: r.tpp,
        }))
      : [],
    distribucionProfesores,
    pagoPorSobrecarga,
    contratosRecientes,
    pagosPendientes: pagosPendientesLista,
    contratosPorEstado,
  };
}
