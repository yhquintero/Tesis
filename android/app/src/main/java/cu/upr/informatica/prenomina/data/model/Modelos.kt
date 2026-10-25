package cu.upr.informatica.prenomina.data.model

import cu.upr.informatica.prenomina.data.local.entity.ContratoEntity
import cu.upr.informatica.prenomina.data.local.entity.PagoEntity
import cu.upr.informatica.prenomina.data.local.entity.ProfesorEntity

/** Contrato con los datos del profesor ya resueltos para la interfaz. */
data class ContratoDetalle(
    val contrato: ContratoEntity,
    val profesor: ProfesorEntity?,
) {
    val nombreProfesor: String get() = profesor?.nombre ?: "Profesor no disponible"
}

/** Pago con su contrato y profesor resueltos. */
data class PagoDetalle(
    val pago: PagoEntity,
    val contrato: ContratoEntity?,
    val profesor: ProfesorEntity?,
) {
    val codigoContrato: String get() = contrato?.codigo ?: "Contrato no disponible"
    val nombreProfesor: String get() = profesor?.nombre ?: "Profesor no disponible"
}

data class ResumenCategoria(
    val categoria: String,
    val horas: Double,
    val contratos: Int,
)

data class DashboardDatos(
    val cargando: Boolean = false,
    val profesoresTotales: Int = 0,
    val profesoresActivos: Int = 0,
    val contratosTotales: Int = 0,
    val contratosPorEstado: Map<String, Int> = emptyMap(),
    val importeContratos: Double = 0.0,
    val pagosPendientes: Int = 0,
    val importePendiente: Double = 0.0,
    val pagosVencidos: Int = 0,
    val horasPorCategoria: List<ResumenCategoria> = emptyList(),
    val contratosRecientes: List<ContratoDetalle> = emptyList(),
    val pagosPendientesLista: List<PagoDetalle> = emptyList(),
) {
    val contratosActivos: Int get() = contratosPorEstado["activo"] ?: 0
}

/** Resultado legible de una operación de escritura. */
data class ResultadoOperacion(
    val exitoso: Boolean,
    val mensaje: String,
)

/** Resultado de una sincronización completa. */
data class ResultadoSync(
    val ok: Boolean,
    val enviados: Int,
    val rechazados: Int,
    val pendientes: Int,
    val mensaje: String,
)

/** Fila de la cola pendiente expuesta en Ajustes. */
data class PendienteVisible(
    val id: Long,
    val operacion: String,
    val entidad: String,
    val ruta: String,
    val metodo: String,
    val creadoEn: Long,
    val ultimoError: String?,
)
